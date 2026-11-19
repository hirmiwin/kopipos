<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\SettingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@toko.com'],
            ['name' => 'Admin', 'role' => 'admin', 'password' => Hash::make('password')],
        );

        foreach (SettingService::DEFAULTS as $key => $value) {
            Setting::query()->updateOrCreate(
                ['key' => $key],
                ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value],
            );
        }

        $categories = collect([
            'Kopi' => 'Kopi panas dan dingin',
            'Minuman Lain' => 'Teh, susu, dan minuman specialties',
            'Makanan' => 'Pastries dan camilan',
        ])->map(fn (string $description, string $name): Category => Category::query()->updateOrCreate(
            ['name' => $name],
            ['slug' => \Illuminate\Support\Str::slug($name)],
        ));

        $catalog = [
            ['Kopi Latte', 'Kopi', 'KOPI-001', '8998866200012', 28000, 12000, 48],
            ['Cappuccino', 'Kopi', 'KOPI-002', '8998866200029', 30000, 13000, 12],
            ['Americano', 'Kopi', 'KOPI-003', '8998866200036', 24000, 9000, 36],
            ['Espresso', 'Kopi', 'KOPI-004', '8998866200043', 22000, 8000, 24],
            ['Kopi Susu Gula Aren', 'Kopi', 'KOPI-005', '8998866200050', 32000, 14000, 3],
            ['Matcha Latte', 'Minuman Lain', 'MIN-001', '8998866200067', 34000, 15000, 20],
            ['Teh Tarik', 'Minuman Lain', 'MIN-002', '8998866200074', 20000, 7000, 30],
            ['Croissant', 'Makanan', 'MAK-001', '8998866200081', 32000, 15000, 15],
            ['Tiramisu', 'Makanan', 'MAK-002', '8998866200098', 38000, 19000, 8],
        ];

        $products = collect();
        foreach ($catalog as [$name, $category, $sku, $barcode, $price, $cost, $stock]) {
            $product = Product::query()->updateOrCreate(
                ['sku' => $sku],
                [
                    'category_id' => $categories->get($category)?->id,
                    'name' => $name,
                    'barcode' => $barcode,
                    'description' => $name.' dari Kami.',
                    'price' => $price,
                    'cost' => $cost,
                    'stock' => $stock,
                    'low_stock_threshold' => 10,
                    'is_active' => true,
                ],
            );
            $products->push($product);

            if (! StockMovement::query()->where('product_id', $product->id)->exists()) {
                StockMovement::query()->create([
                    'product_id' => $product->id,
                    'user_id' => $admin->id,
                    'type' => 'in',
                    'quantity' => $stock,
                    'note' => 'Stok awal',
                ]);
            }
        }

        if (Sale::query()->exists()) {
            return;
        }

        $methods = ['cash', 'qris', 'card', 'transfer'];
        for ($day = 6; $day >= 0; $day -= 1) {
            $salesCount = ($day % 3) + 2;
            for ($index = 0; $index < $salesCount; $index += 1) {
                $chosen = $products->random(rand(1, 3));
                $subtotal = 0.0;
                $lines = [];
                foreach ($chosen as $product) {
                    $quantity = rand(1, 2);
                    $lineTotal = (float) $product->price * $quantity;
                    $lines[] = [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'sku' => $product->sku,
                        'unit_price' => $product->price,
                        'quantity' => $quantity,
                        'discount' => 0,
                        'subtotal' => $lineTotal,
                    ];
                    $subtotal += $lineTotal;
                }
                $sequence = Sale::query()->whereDate('created_at', now()->subDays($day))->count() + 1;
                $sale = Sale::query()->create([
                    'invoice_number' => 'INV/'.now()->subDays($day)->format('Ymd').'/'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT),
                    'user_id' => $cashier->id,
                    'customer_name' => $index % 2 === 0 ? 'Pelanggan Umum' : null,
                    'subtotal' => $subtotal,
                    'discount' => 0,
                    'tax' => 0,
                    'total' => $subtotal,
                    'amount_paid' => $subtotal,
                    'change' => 0,
                    'payment_method' => $methods[array_rand($methods)],
                    'status' => 'completed',
                    'created_at' => now()->subDays($day)->setTime(rand(9, 20), rand(0, 59)),
                ]);
                foreach ($lines as $line) {
                    $sale->items()->create($line);
                }
            }
        }
    }
}
