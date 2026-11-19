<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with('category');

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('low_stock')) {
            $query->whereColumn('stock', '<=', 'low_stock_threshold');
        }

        $query->orderBy('name');

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $paginator = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Product $product): array => $product->toApiArray())->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->toApiArray()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->normalize($this->validateProduct($request));
        $validated['sku'] = $validated['sku'] ?: $this->generateSku($validated['name']);
        $validated['image_path'] = $this->storeImage($request);

        $product = Product::query()->create($validated);

        return response()->json(['data' => $product->toApiArray(), 'message' => 'Produk ditambahkan.'], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $this->normalize($this->validateProduct($request, $product->id), $product);
        unset($validated['stock']); // stock only changes through stock movements

        if ($request->hasFile('image')) {
            $validated['image_path'] = $this->storeImage($request, $product->image_path);
        }

        $product->update($validated);

        return response()->json(['data' => $product->toApiArray(), 'message' => 'Produk diperbarui.']);
    }

    public function destroy(Product $product): JsonResponse
    {
        if ($product->stockMovements()->exists() || $product->saleItems()->exists()) {
            return response()->json(['message' => 'Produk sudah memiliki riwayat. Nonaktifkan produk ini sebagai gantinya.'], 422);
        }

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }
        $product->delete();

        return response()->json(['message' => 'Produk dihapus.']);
    }

    /** @return array<string, mixed> */
    private function validateProduct(Request $request, ?int $id = null): array
    {
        $unique = fn (string $column) => 'unique:products,'.$column.($id ? ','.$id : '');

        return $request->validate([
            'category_id' => ['nullable', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'sku' => ['nullable', 'string', 'max:60', $unique('sku')],
            'barcode' => ['nullable', 'string', 'max:100', $unique('barcode')],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:2048'],
        ], [
            'name.required' => 'Nama produk wajib diisi.',
            'price.required' => 'Harga wajib diisi.',
            'price.numeric' => 'Harga harus berupa angka.',
            'sku.unique' => 'SKU sudah digunakan.',
            'barcode.unique' => 'Barcode sudah digunakan.',
        ]);
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function normalize(array $validated, ?Product $product = null): array
    {
        $validated['cost'] ??= 0;
        $validated['low_stock_threshold'] ??= 5;
        $validated['is_active'] ??= true;

        // sku NOT NULL: blank input preserves the current sku on edit,
        // and generates one on create.
        if (array_key_exists('sku', $validated) && blank($validated['sku'])) {
            $validated['sku'] = $product?->sku ?: $this->generateSku((string) $validated['name']);
        }

        return $validated;
    }

    private function generateSku(string $name): string
    {
        do {
            $sku = 'PRD-'.Str::upper(Str::slug($name, '')).'-'.Str::upper(Str::random(4));
        } while (Product::query()->where('sku', $sku)->exists());

        return $sku;
    }

    private function storeImage(Request $request, ?string $oldPath = null): ?string
    {
        if (! $request->hasFile('image')) {
            return null;
        }

        $path = $request->file('image')->store('products', 'public');

        if ($oldPath && $oldPath !== $path) {
            Storage::disk('public')->delete($oldPath);
        }

        return $path;
    }
}
