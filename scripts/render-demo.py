from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1280
HEIGHT = 720
FPS = 24
SCENE_SECONDS = 2.35
TRANSITION_SECONDS = 0.35
INK = (14, 17, 17)
PAPER = (244, 241, 234)
OXIDE = (180, 74, 42)
BLUE = (34, 92, 126)


@dataclass(frozen=True)
class Scene:
    image: Image.Image
    title: str
    detail: str
    focus_x: float = 0.5
    focus_y: float = 0.5


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def cover(source: Image.Image, progress: float, focus_x: float, focus_y: float) -> Image.Image:
    source = source.convert("RGB")
    source_ratio = source.width / source.height
    target_ratio = WIDTH / HEIGHT
    if source_ratio > target_ratio:
        base_height = source.height
        base_width = round(base_height * target_ratio)
    else:
        base_width = source.width
        base_height = round(base_width / target_ratio)

    zoom = 1.0 + progress * 0.014
    crop_width = max(1, round(base_width / zoom))
    crop_height = max(1, round(base_height / zoom))
    left = round((source.width - crop_width) * focus_x)
    top = round((source.height - crop_height) * focus_y)
    left = max(0, min(source.width - crop_width, left))
    top = max(0, min(source.height - crop_height, top))
    return source.crop((left, top, left + crop_width, top + crop_height)).resize(
        (WIDTH, HEIGHT), Image.Resampling.LANCZOS
    )


def caption(frame: Image.Image, title: str, detail: str) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    title_font = load_font(17, bold=True)
    detail_font = load_font(15)
    title_box = draw.textbbox((0, 0), title, font=title_font)
    detail_box = draw.textbbox((0, 0), detail, font=detail_font)
    width = max(title_box[2], detail_box[2]) + 76
    left = 36
    top = HEIGHT - 112
    draw.rounded_rectangle((left, top, left + width, HEIGHT - 30), radius=12, fill=(14, 17, 17, 230))
    draw.rectangle((left, top, left + 7, HEIGHT - 30), fill=OXIDE + (255,))
    draw.text((left + 26, top + 15), title, font=title_font, fill=PAPER + (255,))
    draw.text((left + 26, top + 45), detail, font=detail_font, fill=(244, 241, 234, 178))


def mobile_stage(controls: Image.Image, graph: Image.Image) -> Image.Image:
    stage = Image.new("RGB", (WIDTH, HEIGHT), INK)
    draw = ImageDraw.Draw(stage, "RGBA")
    for x in range(0, WIDTH, 72):
        draw.line((x, 0, x, HEIGHT), fill=(244, 241, 234, 12), width=1)
    for y in range(0, HEIGHT, 72):
        draw.line((0, y, WIDTH, y), fill=(244, 241, 234, 12), width=1)

    kicker_font = load_font(14, bold=True)
    title_font = load_font(48, bold=True)
    body_font = load_font(18)
    draw.text((54, 70), "RESPONSIVE BY DEFAULT", font=kicker_font, fill=OXIDE)
    draw.text((54, 104), "The same maths,\nmade touch-ready.", font=title_font, fill=PAPER)
    draw.text((57, 232), "Controls and results keep their hierarchy\nat 390 pixels wide.", font=body_font, fill=(244, 241, 234, 166))

    phone_width = 300
    phone_height = 554
    for index, (source, x) in enumerate(((controls, 620), (graph, 944))):
        shot = source.convert("RGB").resize((phone_width, phone_height), Image.Resampling.LANCZOS)
        draw.rounded_rectangle((x - 7, 73, x + phone_width + 7, 73 + phone_height + 14), radius=22, fill=(0, 0, 0, 150))
        stage.paste(shot, (x, 80))
        draw.rounded_rectangle((x, 80, x + phone_width, 80 + phone_height), radius=16, outline=(244, 241, 234, 72), width=2)
        tag = "INPUTS" if index == 0 else "RESULTS"
        draw.rounded_rectangle((x + 16, 96, x + 98, 125), radius=14, fill=INK + (226,))
        draw.text((x + 31, 103), tag, font=load_font(11, bold=True), fill=PAPER)
    return stage


def render_frame(scene: Scene, progress: float) -> Image.Image:
    frame = cover(scene.image, progress, scene.focus_x, scene.focus_y)
    caption(frame, scene.title, scene.detail)
    return frame


def render(scenes: list[Scene], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    scene_frames = round(SCENE_SECONDS * FPS)
    transition_frames = round(TRANSITION_SECONDS * FPS)
    fade_frames = round(0.22 * FPS)
    writer = imageio_ffmpeg.write_frames(
        str(output),
        (WIDTH, HEIGHT),
        fps=FPS,
        codec="libx264",
        pix_fmt_in="rgb24",
        pix_fmt_out="yuv420p",
        output_params=[
            "-crf",
            "22",
            "-preset",
            "medium",
            "-movflags",
            "+faststart",
            "-an",
            "-metadata",
            "title=IntegraDraw product demo",
        ],
    )
    writer.send(None)
    previous: Image.Image | None = None
    try:
        for scene_index, scene in enumerate(scenes):
            first = render_frame(scene, 0.0)
            if previous is not None:
                for index in range(transition_frames):
                    amount = (index + 1) / (transition_frames + 1)
                    writer.send(np.asarray(Image.blend(previous, first, amount), dtype=np.uint8))
            for index in range(scene_frames):
                progress = index / max(1, scene_frames - 1)
                frame = render_frame(scene, progress)
                if scene_index == 0 and index < fade_frames:
                    frame = Image.blend(Image.new("RGB", frame.size, INK), frame, (index + 1) / fade_frames)
                if scene_index == len(scenes) - 1 and index >= scene_frames - fade_frames:
                    amount = (scene_frames - index) / fade_frames
                    frame = Image.blend(Image.new("RGB", frame.size, INK), frame, amount)
                writer.send(np.asarray(frame, dtype=np.uint8))
                previous = frame
    finally:
        writer.close()
        for scene in scenes:
            scene.image.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render the IntegraDraw portfolio demo from real browser captures.")
    parser.add_argument("--hero", type=Path, required=True)
    parser.add_argument("--coarse", type=Path, required=True)
    parser.add_argument("--fine", type=Path, required=True)
    parser.add_argument("--mobile-controls", type=Path, required=True)
    parser.add_argument("--mobile-graph", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    controls = Image.open(args.mobile_controls)
    graph = Image.open(args.mobile_graph)
    mobile = mobile_stage(controls, graph)
    controls.close()
    graph.close()
    scenes = [
        Scene(Image.open(args.hero), "INTEGRADRAW / VISUAL CALCULUS", "A definite integral you can inspect."),
        Scene(Image.open(args.coarse), "8 SEGMENTS / START HERE", "The approximation stays deliberately visible.", 0.55, 0.48),
        Scene(Image.open(args.fine), "160 SEGMENTS / CONVERGENCE", "Midpoint error: 8.67 × 10⁻⁸.", 0.55, 0.48),
        Scene(mobile, "DESKTOP TO MOBILE", "One working model, two useful views."),
    ]
    render(scenes, args.output)


if __name__ == "__main__":
    main()
