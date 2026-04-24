from __future__ import annotations

import html
import json
import re
import string
from pathlib import Path

OUTPUT_DIR_NAME = "out"
READABLE_PREFIX = "\u53ef\u9605\u8bfb"
IMPORT_PREFIX = "\u5bfc\u5165"
SOURCE_CONFIGS = [
    {"dir_name": "\u9009\u62e9", "mode": "choice"},
    {"dir_name": "\u7b80\u7b54", "mode": "short_answer_only"},
    {"dir_name": "\u5224\u65ad", "mode": "true_false_only"},
]


def cleanup_text(value: object) -> str:
    text = str(value or "")
    text = text.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    text = text.replace("&nbsp;", " ")
    text = html.unescape(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_options(raw_options: object) -> list[str]:
    if not raw_options:
        return []

    if isinstance(raw_options, str):
        raw_options = raw_options.strip().replace("\ufeff", "")
        if not raw_options or not raw_options.startswith("["):
            return []
        try:
            parsed = json.loads(raw_options)
        except json.JSONDecodeError:
            return []
    elif isinstance(raw_options, list):
        parsed = raw_options
    else:
        return []

    options: list[str] = []
    for item in parsed:
        if isinstance(item, dict):
            option_text = cleanup_text(item.get("o", ""))
        else:
            option_text = cleanup_text(item)
        if option_text:
            options.append(option_text)
    return options


def answer_letters_from_mask(raw_answer: object) -> list[str]:
    text = cleanup_text(raw_answer)
    if not text:
        return []

    if not re.fullmatch(r"\d+", text):
        return [text]

    mask = int(text)
    letters: list[str] = []
    index = 0

    while mask > 0:
        if mask & 1:
            if index < len(string.ascii_uppercase):
                letters.append(string.ascii_uppercase[index])
        mask >>= 1
        index += 1

    return letters


def infer_question_type(type_code: str, options: list[str], raw_answer: object) -> str | None:
    if type_code == "10":
        return "short_answer"

    letters = answer_letters_from_mask(raw_answer)
    if options:
        if len(letters) <= 1:
            return "single_choice"
        return "multiple_choice"

    return None


def format_answer_for_readable(question_type: str, raw_answer: object) -> str:
    if question_type == "short_answer":
        answer = cleanup_text(raw_answer)
        return answer or ""

    letters = answer_letters_from_mask(raw_answer)
    return "".join(letters)


def build_import_record(question_type: str, stem: str, options: list[str], raw_answer: object) -> dict:
    if question_type == "single_choice":
        letters = answer_letters_from_mask(raw_answer)
        return {
            "type": "single_choice",
            "stem": stem,
            "options": options,
            "answer": letters[0] if letters else "",
            "analysis": "",
        }

    if question_type == "multiple_choice":
        return {
            "type": "multiple_choice",
            "stem": stem,
            "options": options,
            "answer": answer_letters_from_mask(raw_answer),
            "analysis": "",
        }

    return {
        "type": "short_answer",
        "stem": stem,
        "answer": {
            "keywords": [],
            "reference": cleanup_text(raw_answer),
        },
        "analysis": "",
    }


def parse_choice_items(source_file: Path) -> tuple[list[str], list[dict]]:
    payload = json.loads(source_file.read_text(encoding="utf-8"))
    result = payload.get("data", {}).get("result", [])

    readable_lines: list[str] = []
    import_items: list[dict] = []
    sequence = 1

    for item in result:
        type_code = str(item.get("d", "")).strip()
        stem = cleanup_text(item.get("a", ""))
        raw_answer = item.get("c", "")
        options = parse_options(item.get("b", ""))

        question_type = infer_question_type(type_code, options, raw_answer)
        if not question_type or not stem:
            continue

        answer_text = format_answer_for_readable(question_type, raw_answer)
        readable_lines.append(f"{sequence}.{stem}")

        if question_type != "short_answer":
            for index, option in enumerate(options):
                label = string.ascii_uppercase[index]
                readable_lines.append(f"{label}.{option}")

        readable_lines.append(f"\u7b54\u6848\uff1a{answer_text}")
        readable_lines.append("")

        import_items.append(build_import_record(question_type, stem, options, raw_answer))
        sequence += 1

    return readable_lines, import_items


def parse_short_answer_only_items(source_file: Path) -> tuple[list[str], list[dict]]:
    payload = json.loads(source_file.read_text(encoding="utf-8"))
    result = payload.get("data", {}).get("result", [])

    readable_lines: list[str] = []
    import_items: list[dict] = []
    sequence = 1

    for item in result:
        item_id = cleanup_text(item.get("id", ""))
        stem = cleanup_text(item.get("a", ""))
        answer = cleanup_text(item.get("c", ""))

        if not item_id.startswith("s") or not stem or not answer:
            continue

        readable_lines.append(f"{sequence}.{stem}")
        readable_lines.append(f"\u7b54\u6848\uff1a{answer}")
        readable_lines.append("")

        import_items.append(
            {
                "type": "short_answer",
                "stem": stem,
                "answer": {
                    "keywords": [],
                    "reference": answer,
                },
                "analysis": "",
            }
        )
        sequence += 1

    return readable_lines, import_items


def parse_true_false_only_items(source_file: Path) -> tuple[list[str], list[dict]]:
    payload = json.loads(source_file.read_text(encoding="utf-8"))
    result = payload.get("data", {}).get("result", [])

    readable_lines: list[str] = []
    import_items: list[dict] = []
    sequence = 1

    for item in result:
        item_id = cleanup_text(item.get("id", ""))
        stem = cleanup_text(item.get("a", ""))
        answer_code = cleanup_text(item.get("c", ""))

        if not item_id.startswith("s") or not stem or answer_code not in {"1", "2"}:
            continue

        answer_bool = answer_code == "1"
        answer_text = "√" if answer_bool else "×"

        readable_lines.append(f"{sequence}.{stem}")
        readable_lines.append(f"\u7b54\u6848\uff1a{answer_text}")
        readable_lines.append("")

        import_items.append(
            {
                "type": "true_false",
                "stem": stem,
                "answer": answer_bool,
                "analysis": "",
            }
        )
        sequence += 1

    return readable_lines, import_items


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    output_dir = root / "item_bank" / OUTPUT_DIR_NAME
    output_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    total_questions = 0

    for config in SOURCE_CONFIGS:
        source_dir = root / "item_bank" / config["dir_name"]
        if not source_dir.exists():
            raise SystemExit(f"Source directory not found: {source_dir}")

        parser = (
            parse_choice_items
            if config["mode"] == "choice"
            else parse_short_answer_only_items
            if config["mode"] == "short_answer_only"
            else parse_true_false_only_items
        )

        for source_file in sorted(path for path in source_dir.iterdir() if path.is_file()):
            readable_lines, import_items = parser(source_file)
            total_questions += len(import_items)

            readable_path = output_dir / f"{READABLE_PREFIX}{source_file.name}.txt"
            import_path = output_dir / f"{IMPORT_PREFIX}{source_file.name}.json"

            readable_path.write_text("\n".join(readable_lines).rstrip() + "\n", encoding="utf-8-sig")
            import_path.write_text(
                json.dumps(import_items, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            processed += 1

    print(f"Processed {processed} files and {total_questions} questions into {output_dir}")


if __name__ == "__main__":
    main()
