#!/usr/bin/env python3
"""Build the web-ready Live2D model from the VTube Studio source folder."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "hirolive2d"
OUTPUT_DIR = ROOT / "public" / "live2d" / "hiro"
TEXTURE_SIZE = 4096
WEBP_QUALITY = 85
EXPRESSIONS = ("monvhua", "taishou", "zuibu")
MAIN_TEXTURE = "textures/texture_00.png"
FALLBACK_TEXTURE = "textures/texture_00.webp"


def find_source_dir() -> Path:
    candidates = sorted(SOURCE_ROOT.rglob("*.model3.json"))
    if not candidates:
        sys.exit(f"No .model3.json found under {SOURCE_ROOT}")
    return candidates[0].parent


def copy_single(source_dir: Path, pattern: str, target: Path) -> None:
    matches = sorted(source_dir.glob(pattern))
    if not matches:
        sys.exit(f"Missing {pattern} in {source_dir}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(matches[0], target)


def write_model(path: Path, texture: str) -> None:
    model = {
        "Version": 3,
        "FileReferences": {
            "Moc": "hiro.moc3",
            "Textures": [texture],
            "Physics": "hiro.physics3.json",
            "DisplayInfo": "hiro.cdi3.json",
            "Expressions": [
                {"Name": name, "File": f"expressions/{name}.exp3.json"}
                for name in EXPRESSIONS
            ],
        },
        "Groups": [
            {"Target": "Parameter", "Name": "LipSync", "Ids": ["ParamMouthOpenY"]},
            {
                "Target": "Parameter",
                "Name": "EyeBlink",
                "Ids": ["ParamEyeLOpen", "ParamEyeROpen"],
            },
        ],
    }
    path.write_text(
        json.dumps(model, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    source_dir = find_source_dir()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "textures").mkdir(exist_ok=True)
    (OUTPUT_DIR / "expressions").mkdir(exist_ok=True)

    copy_single(source_dir, "*.moc3", OUTPUT_DIR / "hiro.moc3")
    copy_single(source_dir, "*.physics3.json", OUTPUT_DIR / "hiro.physics3.json")
    copy_single(source_dir, "*.cdi3.json", OUTPUT_DIR / "hiro.cdi3.json")

    for name in EXPRESSIONS:
        source = source_dir / f"{name}.exp3.json"
        if not source.exists():
            sys.exit(f"Missing expression {source}")
        shutil.copy2(source, OUTPUT_DIR / "expressions" / source.name)

    texture_candidates = sorted(source_dir.rglob("texture_*.png"))
    if not texture_candidates:
        sys.exit(f"Missing texture under {source_dir}")
    texture_path = texture_candidates[0]

    shutil.copy2(texture_path, OUTPUT_DIR / "textures" / "texture_00.png")

    with Image.open(texture_path) as image:
        rgba = image.convert("RGBA")
        resized = rgba.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)
        resized.save(
            OUTPUT_DIR / "textures" / "texture_00.webp",
            format="WEBP",
            quality=WEBP_QUALITY,
            method=6,
            alpha_quality=100,
        )

    write_model(OUTPUT_DIR / "hiro.model3.json", MAIN_TEXTURE)
    write_model(OUTPUT_DIR / "hiro-4096.model3.json", FALLBACK_TEXTURE)

    total = 0
    for path in sorted(OUTPUT_DIR.rglob("*")):
        if not path.is_file():
            continue
        size = path.stat().st_size
        total += size
        print(f"{path.relative_to(ROOT)}  {size / 1024 / 1024:.2f} MB")
    print(f"total  {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
