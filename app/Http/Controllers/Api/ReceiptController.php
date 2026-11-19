<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Services\ReceiptService;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReceiptController extends Controller
{
    public function __construct(
        private readonly ReceiptService $receipts,
        private readonly SettingService $settings,
    ) {}

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'customer_name' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['nullable', 'in:cash,card,qris,transfer'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
        ]);

        $products = Product::query()->whereIn('id', array_column($validated['items'], 'product_id'))->get()->keyBy('id');
        $items = [];
        $subtotal = 0.0;

        foreach ($validated['items'] as $item) {
            $product = $products->get($item['product_id']);
            if (! $product) {
                continue;
            }
            $quantity = (int) $item['quantity'];
            $lineSubtotal = (float) $product->price * $quantity;
            $items[] = [
                'name' => $product->name,
                'quantity' => $quantity,
                'unit_price' => (float) $product->price,
                'subtotal' => $lineSubtotal,
            ];
            $subtotal += $lineSubtotal;
        }

        $discount = min((float) ($validated['discount'] ?? 0), $subtotal);
        $taxable = $subtotal - $discount;
        $settings = $this->settings->all();
        $tax = $settings['tax_enabled'] ? round($taxable * ((float) $settings['tax_rate'] / 100), 2) : 0;
        $total = round($taxable + $tax, 2);
        $paid = (float) ($validated['amount_paid'] ?? $total);

        return response()->json(['data' => $this->receipts->build([
            'invoice_number' => 'PREVIEW',
            'cashier' => $request->user()?->name ?? 'Kasir',
            'customer_name' => $validated['customer_name'] ?? null,
            'items' => $items,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'total' => $total,
            'amount_paid' => max($paid, $total),
            'change' => max($paid, $total) - $total,
            'payment_method' => $validated['payment_method'] ?? 'cash',
        ])]);
    }

    public function raw(Sale $sale): Response
    {
        $payload = $this->receipts->forSale($sale);

        return response(base64_decode($payload['escpos_base64'], true) ?: '', 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="struk-'.$sale->invoice_number.'.bin"',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function test(): JsonResponse
    {
        return response()->json(['data' => $this->receipts->build([
            'invoice_number' => 'TEST/'.now()->format('Ymd').'/0001',
            'cashier' => auth()->user()?->name ?? 'Kasir',
            'customer_name' => null,
            'items' => [
                ['name' => 'Kopi Latte', 'quantity' => 2, 'unit_price' => 28000, 'subtotal' => 56000],
                ['name' => 'Croissant', 'quantity' => 1, 'unit_price' => 32000, 'subtotal' => 32000],
            ],
            'subtotal' => 88000,
            'discount' => 0,
            'tax' => 0,
            'total' => 88000,
            'amount_paid' => 100000,
            'change' => 12000,
            'payment_method' => 'cash',
        ])]);
    }
}
