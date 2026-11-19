<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function __construct(private readonly SettingService $settings) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->settings->all()]);
    }

    /** Public branding used by the login screen and app shell. */
    public function brand(): JsonResponse
    {
        $settings = $this->settings->all();

        return response()->json(['data' => [
            'store_name' => $settings['store_name'],
            'logo_url' => $settings['logo_url'],
        ]]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate(SettingService::RULES);
        $settings = $this->settings->update($validated);

        return response()->json(['data' => $settings, 'message' => 'Pengaturan toko disimpan.']);
    }

    public function logo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'logo' => ['required', 'image', 'max:2048'],
        ], ['logo.required' => 'Pilih file logo terlebih dahulu.']);

        $url = $this->settings->uploadLogo($validated['logo']);

        return response()->json(['data' => ['logo_url' => $url], 'message' => 'Logo diperbarui.']);
    }
}
