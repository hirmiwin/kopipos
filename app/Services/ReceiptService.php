<?php

namespace App\Services;

use App\Models\Sale;

class ReceiptService
{
    public function __construct(private readonly SettingService $settings) {}

    /** @return array<string, mixed> */
    public function forSale(Sale $sale): array
    {
        $sale->loadMissing('cashier', 'items');

        return $this->build([
            'invoice_number' => $sale->invoice_number,
            'created_at' => $sale->created_at?->toISOString() ?? now()->toISOString(),
            'cashier' => $sale->cashier?->name ?? 'Kasir',
            'customer_name' => $sale->customer_name,
            'items' => $sale->items->map(fn ($item): array => [
                'name' => $item->product_name,
                'quantity' => $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'subtotal' => (float) $item->subtotal,
            ])->all(),
            'subtotal' => (float) $sale->subtotal,
            'discount' => (float) $sale->discount,
            'tax' => (float) $sale->tax,
            'total' => (float) $sale->total,
            'amount_paid' => (float) $sale->amount_paid,
            'change' => (float) $sale->change,
            'payment_method' => $sale->payment_method,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function build(array $data): array
    {
        $settings = $this->settings->all();
        $payload = [
            'invoice_number' => (string) ($data['invoice_number'] ?? '-'),
            'created_at' => (string) ($data['created_at'] ?? now()->toISOString()),
            'cashier' => (string) ($data['cashier'] ?? 'Kasir'),
            'customer_name' => $data['customer_name'] ?? null,
            'items' => array_values($data['items'] ?? []),
            'subtotal' => (float) ($data['subtotal'] ?? 0),
            'discount' => (float) ($data['discount'] ?? 0),
            'tax' => (float) ($data['tax'] ?? 0),
            'total' => (float) ($data['total'] ?? 0),
            'amount_paid' => (float) ($data['amount_paid'] ?? 0),
            'change' => (float) ($data['change'] ?? 0),
            'payment_method' => (string) ($data['payment_method'] ?? 'cash'),
            'settings' => $settings,
        ];

        $payload['escpos_base64'] = base64_encode($this->escpos($payload)->bytes());

        return $payload;
    }

    /** @param array<string, mixed> $payload */
    private function escpos(array $payload): EscposBuilder
    {
        /** @var array<string, mixed> $settings */
        $settings = $payload['settings'];
        $width = (string) ($settings['receipt_width'] ?? '80') === '58' ? 32 : 48;
        $printer = new EscposBuilder($width);
        $money = fn (float $value): string => ($settings['currency'] ?? 'IDR').' '.number_format($value, 0, ',', '.');

        $printer->initialize();
        if (! empty($settings['store_logo_line'])) {
            $printer->center((string) $settings['store_logo_line']);
        }
        $printer->center((string) $settings['store_name'], true, true);
        if ($settings['store_address']) {
            $printer->center((string) $settings['store_address']);
        }
        if ($settings['store_phone']) {
            $printer->center('Telp: '.$settings['store_phone']);
        }
        $printer->divider('=');

        foreach (explode("\n", (string) ($settings['receipt_header'] ?? '')) as $line) {
            if (trim($line) !== '') {
                $printer->center(trim($line));
            }
        }
        $printer->divider('=');

        $printer->left('No: '.$payload['invoice_number']);
        $printer->left('Tgl: '.$this->formatDate($payload['created_at']));
        $printer->left('Kasir: '.$payload['cashier']);
        if ($payload['customer_name']) {
            $printer->left('Pelanggan: '.$payload['customer_name']);
        }
        $printer->divider('-');

        /** @var array<int, array<string, mixed>> $items */
        $items = $payload['items'];
        foreach ($items as $item) {
            $name = (string) ($item['name'] ?? '-');
            $quantity = (int) ($item['quantity'] ?? 1);
            $price = (float) ($item['unit_price'] ?? 0);
            $subtotal = (float) ($item['subtotal'] ?? $quantity * $price);
            $printer->left($name);
            $printer->twoColumn(
                sprintf('%d x %s', $quantity, $money($price)),
                $money($subtotal),
            );
        }

        $printer->divider('-');
        $printer->twoColumn('Subtotal', $money($payload['subtotal']));
        if ($payload['discount'] > 0) {
            $printer->twoColumn('Diskon', '-'.$money($payload['discount']));
        }
        if ($payload['tax'] > 0) {
            $printer->twoColumn('Pajak', $money($payload['tax']));
        }
        $printer->divider('=');
        $printer->twoColumn('TOTAL', $money($payload['total']), true);
        $printer->divider('=');
        $printer->twoColumn('Bayar', $money($payload['amount_paid']));
        $printer->twoColumn('Kembali', $money($payload['change']));
        $printer->left('Metode: '.strtoupper($payload['payment_method']));
        $printer->feed();

        foreach (explode("\n", (string) ($settings['receipt_footer'] ?? '')) as $line) {
            if (trim($line) !== '') {
                $printer->center(trim($line));
            }
        }
        $printer->feed();
        $printer->center('-- POS Kopi POS --');

        if (! empty($settings['open_drawer'])) {
            $printer->openDrawer();
        }
        $printer->cut();

        return $printer;
    }

    private function formatDate(string $iso): string
    {
        try {
            return \Illuminate\Support\Carbon::parse($iso)->format('d/m/Y H:i');
        } catch (\Throwable) {
            return $iso;
        }
    }
}
