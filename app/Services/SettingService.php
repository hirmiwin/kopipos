<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SettingService
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'store_name' => 'Sweet Spot Coffee',
        'store_address' => 'Jl. Kopi No. 12, Jakarta Selatan',
        'store_phone' => '021-1234-5678',
        'store_email' => 'halo@sweetspotcoffee.test',
        'receipt_header' => 'Terima kasih telah berbelanja',
        'receipt_footer' => 'Simpan struk ini sebagai bukti pembayaran',
        'logo_url' => null,
        'currency' => 'IDR',
        'tax_enabled' => false,
        'tax_rate' => 0,
        'receipt_width' => '80',
        'auto_print' => false,
        'print_method' => 'browser',
        'serial_baud_rate' => 9600,
        'low_stock_threshold' => 5,
        'timezone' => 'Asia/Jakarta',
    ];

    /** @var array<string, string> */
    public const RULES = [
        'store_name' => 'required|string|max:100',
        'store_address' => 'nullable|string|max:255',
        'store_phone' => 'nullable|string|max:40',
        'store_email' => 'nullable|email|max:100',
        'receipt_header' => 'nullable|string|max:100',
        'receipt_footer' => 'nullable|string|max:150',
        'currency' => 'required|string|in:IDR,USD',
        'tax_enabled' => 'boolean',
        'tax_rate' => 'numeric|min:0|max:100',
        'receipt_width' => 'required|string|in:58,80',
        'auto_print' => 'boolean',
        'print_method' => 'required|string|in:browser,serial',
        'serial_baud_rate' => 'integer|min:1200|max:115200',
        'low_stock_threshold' => 'integer|min:0|max:99999',
        'timezone' => 'required|string|max:60',
    ];

    /** @return array<string, mixed> */
    public function all(): array
    {
        $rows = Setting::query()->pluck('value', 'key')->all();
        $settings = [];

        foreach (self::DEFAULTS as $key => $default) {
            $raw = $rows[$key] ?? null;
            if ($raw === null) {
                $settings[$key] = $default;
                continue;
            }
            $settings[$key] = match (true) {
                is_bool($default) => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
                is_int($default) => (int) $raw,
                is_float($default) => (float) $raw,
                default => (string) $raw,
            };
        }

        $settings['logo_url'] = $rows['logo_url'] ?? null;

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public function update(array $values): array
    {
        foreach ($values as $key => $value) {
            if ($key === 'logo_url') {
                continue;
            }
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }
            $stored = is_bool($value) ? ($value ? '1' : '0') : (string) $value;
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $stored]);
        }

        return $this->all();
    }

    public function uploadLogo(UploadedFile $file): string
    {
        $path = $file->storeAs('store', 'logo.'.$file->getClientOriginalExtension(), 'public');
        Setting::query()->updateOrCreate(['key' => 'logo_url'], ['value' => '/storage/'.$path]);

        return '/storage/'.$path;
    }
}
