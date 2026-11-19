<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Services\ReceiptService;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleController extends Controller
{
    public function __construct(
        private readonly ReceiptService $receipts,
        private readonly SettingService $settings,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()->with('cashier:id,name,role');

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($builder) use ($search): void {
                $builder->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%");
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($from = $request->string('from')->trim()->toString()) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->string('to')->trim()->toString()) {
            $query->whereDate('created_at', '<=', $to);
        }

        $paginator = $query->latest()->paginate(min(max($request->integer('per_page', 15), 1), 100))->withQueryString();

        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Sale $sale): array => $sale->toApiArray())->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json([
            'data' => $sale->toApiArray(),
            'receipt' => $this->receipts->forSale($sale),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'customer_name' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['required', 'in:cash,card,qris,transfer'],
            'amount_paid' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'items.required' => 'Keranjang masih kosong.',
            'items.min' => 'Keranjang masih kosong.',
            'amount_paid.required' => 'Jumlah bayar wajib diisi.',
            'payment_method.required' => 'Metode pembayaran wajib dipilih.',
        ]);

        $settingValues = $this->settings->all();
        $sale = DB::transaction(function () use ($validated, $request, $settingValues): Sale {
            $ids = array_column($validated['items'], 'product_id');
            $products = Product::query()
                ->whereIn('id', $ids)
                ->where('is_active', true)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $lineItems = [];
            $subtotal = 0.0;
            $itemDiscountTotal = 0.0;

            foreach ($validated['items'] as $index => $item) {
                $product = $products->get($item['product_id']);
                if (! $product) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'Produk tidak tersedia.',
                    ]);
                }
                if ($product->stock < $item['quantity']) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => "Stok {$product->name} tidak mencukupi.",
                    ]);
                }

                $quantity = (int) $item['quantity'];
                $price = (float) $product->price;
                $discount = min((float) ($item['discount'] ?? 0), $price * $quantity);
                $lineSubtotal = $price * $quantity - $discount;

                $lineItems[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $product->sku,
                    'unit_price' => $price,
                    'quantity' => $quantity,
                    'discount' => $discount,
                    'subtotal' => $lineSubtotal,
                ];
                $subtotal += $price * $quantity;
                $itemDiscountTotal += $discount;
            }

            $headerDiscount = (float) ($validated['discount'] ?? 0);
            $discount = min($itemDiscountTotal + $headerDiscount, $subtotal);
            $taxable = $subtotal - $discount;
            $tax = $settingValues['tax_enabled'] ? round($taxable * ((float) $settingValues['tax_rate'] / 100), 2) : 0;
            $total = round($taxable + $tax, 2);
            $amountPaid = (float) $validated['amount_paid'];

            if ($amountPaid + 0.001 < $total) {
                throw ValidationException::withMessages([
                    'amount_paid' => 'Jumlah bayar kurang dari total belanja.',
                ]);
            }

            $sale = Sale::query()->create([
                'invoice_number' => $this->nextInvoiceNumber(),
                'user_id' => $request->user()->id,
                'customer_name' => $validated['customer_name'] ?? null,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'total' => $total,
                'amount_paid' => $amountPaid,
                'change' => round($amountPaid - $total, 2),
                'payment_method' => $validated['payment_method'],
                'status' => 'completed',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($lineItems as $line) {
                $sale->items()->create($line);
                Product::query()->whereKey($line['product_id'])->decrement('stock', $line['quantity']);
                StockMovement::query()->create([
                    'product_id' => $line['product_id'],
                    'user_id' => $request->user()->id,
                    'type' => 'sale',
                    'quantity' => -$line['quantity'],
                    'note' => 'Penjualan '.$sale->invoice_number,
                ]);
            }

            return $sale;
        });

        $sale->load('cashier:id,name,role', 'items');

        return response()->json([
            'data' => $sale->toApiArray(),
            'receipt' => $this->receipts->forSale($sale),
            'message' => 'Transaksi berhasil.',
        ], 201);
    }

    public function void(Sale $sale): JsonResponse
    {
        if ($sale->status === 'void') {
            return response()->json(['message' => 'Transaksi sudah dibatalkan.'], 422);
        }

        DB::transaction(function () use ($sale): void {
            foreach ($sale->items as $item) {
                if ($item->product_id) {
                    Product::query()->whereKey($item->product_id)->increment('stock', $item->quantity);
                    StockMovement::query()->create([
                        'product_id' => $item->product_id,
                        'user_id' => auth()->id(),
                        'type' => 'void',
                        'quantity' => $item->quantity,
                        'note' => 'Void '.$sale->invoice_number,
                    ]);
                }
            }
            $sale->update(['status' => 'void']);
        });

        return response()->json(['data' => $sale->toApiArray(), 'message' => 'Transaksi dibatalkan.']);
    }

    private function nextInvoiceNumber(): string
    {
        $date = now()->format('Ymd');

        for ($attempt = 1; $attempt <= 20; $attempt += 1) {
            $sequence = Sale::query()->whereDate('created_at', today())->count() + $attempt;
            $candidate = 'INV/'.$date.'/'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
            if (! Sale::query()->where('invoice_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        return 'INV/'.$date.'/'.strtoupper(uniqid());
    }
}
