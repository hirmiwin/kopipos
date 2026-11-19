<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $today = now()->toDateString();

        $todayQuery = Sale::query()->where('status', 'completed')->whereDate('created_at', $today);
        $weekly = Sale::query()
            ->where('status', 'completed')
            ->whereDate('created_at', '>=', now()->subDays(6)->toDateString())
            ->selectRaw('DATE(created_at) as date, SUM(total) as total')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $weeklyRevenue = [];
        for ($day = 6; $day >= 0; $day -= 1) {
            $date = now()->subDays($day)->toDateString();
            $weeklyRevenue[] = [
                'date' => $date,
                'total' => (float) ($weekly->get($date)?->total ?? 0),
            ];
        }

        $recentSales = Sale::query()
            ->with('cashier:id,name,role')
            ->withCount('items')
            ->latest()
            ->limit(6)
            ->get();

        $lowStock = Product::query()
            ->where('is_active', true)
            ->whereColumn('stock', '<=', 'low_stock_threshold')
            ->orderBy('stock')
            ->limit(6)
            ->get(['id', 'name', 'sku', 'stock', 'low_stock_threshold']);

        return response()->json(['data' => [
            'today_revenue' => (float) (clone $todayQuery)->sum('total'),
            'today_transactions' => (clone $todayQuery)->count(),
            'total_products' => Product::query()->where('is_active', true)->count(),
            'low_stock_products' => Product::query()->where('is_active', true)->whereColumn('stock', '<=', 'low_stock_threshold')->count(),
            'weekly_revenue' => $weeklyRevenue,
            'recent_sales' => $recentSales->map(fn (Sale $sale): array => [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number,
                'total' => (float) $sale->total,
                'status' => $sale->status,
                'payment_method' => $sale->payment_method,
                'customer_name' => $sale->customer_name,
                'items_count' => $sale->items_count,
                'cashier' => $sale->cashier ? ['id' => $sale->cashier->id, 'name' => $sale->cashier->name] : null,
                'created_at' => $sale->created_at?->toISOString(),
            ])->all(),
            'low_stock_list' => $lowStock->all(),
        ]]);
    }
}
