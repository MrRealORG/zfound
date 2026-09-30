# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

SPEC_DIR = Path(SPECPATH)
ROOT_DIR = SPEC_DIR.parent

datas = [
    (str(SPEC_DIR / 'web'), 'web'),
    (str(SPEC_DIR / 'assets'), 'assets'),
    (str(SPEC_DIR / 'core'), 'core'),
]

# Collect any transformers and webview resources if needed
datas += collect_data_files('transformers', include_py_files=False)
datas += collect_data_files('webview', include_py_files=False)

hiddenimports = [
    'webview',
    'webview.platforms',
    'webview.platforms.winforms',
    'clr',
    'pythonnet',
    'torch',
    'transformers',
    'transformers.models.clip',
    'transformers.models.siglip',
    'PIL',
    'PIL.Image',
    'PIL.ImageOps',
    'imagehash',
    'numpy',
    'core',
    'core.scanner',
    'core.hasher',
    'core.embedder',
    'core.indexer',
]

hiddenimports += collect_submodules('webview')

a = Analysis(
    [str(SPEC_DIR / 'app.py')],
    pathex=[str(SPEC_DIR), str(ROOT_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'IPython',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ZFound',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(SPEC_DIR / 'assets' / 'icon.ico'),
)
