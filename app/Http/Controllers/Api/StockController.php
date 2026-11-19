<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockController extends Controller
{
    public function movements(Request $request): JsonResponse
    {
        $query = StockMovement::query()->with(['product:id,name,sku', 'user:id,name']);

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->integer('product_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }
        if ($from = $request->string('from')->trim()->toString()) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->string('to')->trim()->toString()) {
            $query->whereDate('created_at', '<=', $to);
        }

        $paginator = $query->latest()->paginate(min(max($request->integer('per_page', 15), 1), 100))->withQueryString();

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function adjust(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'type' => ['required', 'in:in,out,adjustment'],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'product_id.required' => 'Produk wajib dipilih.',
            'quantity.required' => 'Jumlah wajib diisi.',
            'quantity.min' => 'Jumlah minimal 1.',
        ]);

        $movement = DB::transaction(function () use ($validated, $request): StockMovement {
            $product = Product::query()->whereKey($validated['product_id'])->lockForUpdate()->firstOrFail();
            $delta = $validated['type'] === 'in' ? $validated['quantity'] : -$validated['quantity'];

            if ($product->stock + $delta < 0) {
                throw ValidationException::withMessages([
                    'quantity' => 'Stok tidak mencukupi untuk pengeluaran ini.',
                ]);
            }

            $product->increment('stock', $delta);

            return StockMovement::query()->create([
                'product_id' => $product->id,
                'user_id' => $request->user()->id,
                'type' => $validated['type'],
                'quantity' => $delta,
                'note' => $validated['note'] ?? null,
            ]);
        });

        return response()->json([
            'data' => $movement->load('product:id,name,sku'),
            'message' => 'Stok berhasil diperbarui.',
        ], 201);
    }

    public function lowStock(): JsonResponse
    {
        $products = Product::query()
            ->where('is_active', true)
            ->whereColumn('stock', '<=', 'low_stock_threshold')
            ->orderBy('stock')
            ->get(['id', 'name', 'sku', 'stock', 'low_stock_threshold']);

        return response()->json(['data' => $products]);
    }
}
