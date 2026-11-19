<?php

namespace App\Services;

/**
 * Minimal ESC/POS encoder for 58/80 mm thermal printers.
 * All text is converted to a single-byte charset so column padding is exact.
 */
class EscposBuilder
{
    private string $buffer = '';

    public function __construct(public readonly int $width = 48) {}

    public function initialize(): self
    {
        $this->raw("\x1B@");
        $this->raw("\x1Ba\x00"); // left align
        $this->raw("\x1B!\x00"); // normal style

        return $this;
    }

    public function raw(string $bytes): self
    {
        $this->buffer .= $bytes;

        return $this;
    }

    public function align(int $alignment): self
    {
        $this->raw("\x1Ba".chr(max(0, min(2, $alignment))));

        return $this;
    }

    public function bold(bool $enabled = true): self
    {
        $this->raw("\x1B!".chr($enabled ? 0x08 : 0x00));

        return $this;
    }

    public function size(bool $doubleWidth = false, bool $doubleHeight = false): self
    {
        $n = ($doubleWidth ? 0x10 : 0x00) | ($doubleHeight ? 0x01 : 0x00);
        $this->raw("\x1D!".chr($n));

        return $this;
    }

    public function text(string $text): self
    {
        $this->raw($this->encode($text));

        return $this;
    }

    public function line(string $text = ''): self
    {
        $this->text($text);
        $this->raw("\x0A");

        return $this;
    }

    public function left(string $text, bool $bold = false, bool $double = false): self
    {
        $this->align(0);
        $this->bold($bold);
        $this->size($double, $double);
        $this->line($text);
        $this->size(false, false);
        $this->bold(false);

        return $this;
    }

    public function center(string $text, bool $bold = false, bool $double = false): self
    {
        $encoded = $this->encode($text);
        $visible = strlen($encoded) * ($double ? 2 : 1);
        $pad = max(0, (int) floor(($this->width - $visible) / 2));
        $this->align(1);
        $this->bold($bold);
        $this->size($double, $double);
        $this->rawLine(str_repeat(' ', $pad).$encoded);
        $this->size(false, false);
        $this->bold(false);
        $this->align(0);

        return $this;
    }

    public function right(string $text, bool $bold = false): self
    {
        $encoded = $this->encode($text);
        $pad = max(0, $this->width - strlen($encoded));
        $this->align(0);
        $this->bold($bold);
        $this->rawLine(str_repeat(' ', $pad).$encoded);
        $this->bold(false);

        return $this;
    }

    public function twoColumn(string $left, string $right, bool $bold = false): self
    {
        $leftText = $this->encode($left);
        $rightText = $this->encode($right);
        $maxLeft = max(1, $this->width - strlen($rightText) - 1);
        $leftText = substr($leftText, 0, $maxLeft);
        $gap = max(1, $this->width - strlen($leftText) - strlen($rightText));
        $this->bold($bold);
        $this->rawLine($leftText.str_repeat(' ', $gap).$rightText);
        $this->bold(false);

        return $this;
    }

    public function divider(string $char = '-'): self
    {
        return $this->line(str_repeat($char, $this->width));
    }

    public function feed(int $lines = 1): self
    {
        $this->raw(str_repeat("\x0A", max(0, $lines)));

        return $this;
    }

    public function openDrawer(): self
    {
        $this->raw("\x1Bp\x00\x19\xFA");

        return $this;
    }

    public function cut(): self
    {
        $this->feed(3);
        $this->raw("\x1DV\x42\x00");

        return $this;
    }

    public function bytes(): string
    {
        return $this->buffer;
    }

    /** Writes already-encoded ESC/POS bytes followed by a line feed. */
    private function rawLine(string $bytes): self
    {
        $this->raw($bytes);
        $this->raw("\x0A");

        return $this;
    }

    private function encode(string $text): string
    {
        $text = str_replace(
            ['—', '–', '’', '‘', '“', '”', '•', ' '],
            ['-', '-', "'", "'", '"', '"', '*', ' '],
            $text,
        );

        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'CP437//TRANSLIT', $text);
            if ($converted !== false) {
                return $converted;
            }
        }

        return preg_replace('/[^\x20-\x7E]/', '?', $text) ?? '';
    }
}
