<?php

use Illuminate\Support\Facades\Route;

// Laravel serves existing files from public/ (including Vite assets) before this route.
// Everything else is handled by the React SPA.
Route::get('/{path?}', function () {
    return view('app');
})->where('path', '.*')->name('spa');
