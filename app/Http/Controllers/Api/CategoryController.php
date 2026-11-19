<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->withCount('products')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name'],
        ], ['name.required' => 'Nama kategori wajib diisi.', 'name.unique' => 'Nama kategori sudah ada.']);

        $category = Category::query()->create([
            'name' => $validated['name'],
            'slug' => $this->generateSlug($validated['name']),
        ]);

        return response()->json(['data' => $category, 'message' => 'Kategori ditambahkan.'], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name,'.$category->id],
        ], ['name.required' => 'Nama kategori wajib diisi.', 'name.unique' => 'Nama kategori sudah ada.']);

        $category->update([
            'name' => $validated['name'],
            'slug' => $this->generateSlug($validated['name']),
        ]);

        return response()->json(['data' => $category, 'message' => 'Kategori diperbarui.']);
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->exists()) {
            return response()->json([
                'message' => 'Kategori masih memiliki produk. Pindahkan produknya dulu.',
            ], 422);
        }
        $category->delete();

        return response()->json(['message' => 'Kategori dihapus.']);
    }

    private function generateSlug(string $name): string
    {
        do {
            $slug = Str::slug($name).'-'.Str::lower(Str::random(4));
        } while (Category::query()->where('slug', $slug)->exists());

        return $slug;
    }
}
