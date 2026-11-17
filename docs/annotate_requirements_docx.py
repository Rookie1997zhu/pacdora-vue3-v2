# -*- coding: utf-8 -*-
"""Annotate BOXCRAFT requirements docx with blue Korean replies."""
from __future__ import annotations

import copy
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NSMAP = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

SRC = Path(__file__).with_name("BOXCRAFT 주요필요사항 1차 261114.docx")
DST = Path(__file__).with_name("BOXCRAFT 주요필요사항 1차 261114_답변.docx")

# Marker text (exact paragraph start) → blue Korean reply paragraphs inserted AFTER that paragraph.
REPLIES: list[tuple[str, list[str]]] = [
    # 철학/협업 머리글은 답변하지 않음 (요청)
    (
        "- 각각의 박스에 예상 디자인을",
        [
            "【답변｜파랑｜상태: 구현됨】스튜디오에서 이미지 레이어를 올려 2D 전개도·3D 접힘 미리보기에 바로 반영됩니다. 다음 개선은 ‘템플릿별 예시 디자인 원클릭 적용’입니다.",
        ],
    ),
    (
        "- 각각의 박스에 사용될 종이 재질을",
        [
            "【답변｜파랑｜상태: 구현됨(일부)】kraft / white / blue 재질 선택과 3D 미리보기 반영은 있습니다. 한국 시장용 명칭(크라프트·아트지 등)과 질감 프리셋을 조사 후 카탈로그에 맞추겠습니다.",
            "【답변｜파랑｜재질 에셋】미리보기용 상용 재질(텍스처) 팩을 찾아 구매·다운로드해 접속합니다. 직접 제작은 시간이 많이 들므로, 자체 개발보다 상용 팩 도입이 맞습니다.",
        ],
    ),
    (
        "- 종이 두께(150g, 250g, 350g, 1골지 등)를",
        [
            "【답변｜파랑｜상태: 부분 구현】엔진에는 thicknessMm·내면/외면(sizeMode)·골방향이 있으나, UI에 gsm/골지 선택과 안·밖 치수 동시 표시가 부족합니다. 11월 3주 우선: ①한국 상용 지종·평량 조사 ②선택 UI + 안·밖 치수 병기(PACDORA형).",
        ],
    ),
    (
        "① 먼저 한국에서 주로 사용하는",
        [
            "【답변｜파랑｜작업】한국 상용 지종·평량·골지 표 조사 후 seed/카탈로그에 반영합니다. 결과는 별도 표로 공유하겠습니다.",
        ],
    ),
    (
        "② 분석 결과를 바탕으로",
        [
            "【답변｜파랑｜가능】가능합니다. deriveSizes로 내면/패널/외면 계산이 이미 있어, UI에 병기하면 됩니다.",
        ],
    ),
    (
        "- 중국어로 제작된 사이트를 자동번역기로",
        [
            "【답변｜파랑｜상태: 부분 대응】사이트는 이미 네이티브 zh-CN / ko-KR 전환(자동번역 아님)입니다. SEO·국가별 콘텐츠 분리·접속국 자동 언어는 아직입니다. 다음: 한국어 랜딩/메타 강화 → 이후 접속국 자동 언어.",
        ],
    ),
    (
        "- 박스의 종류와 박스별 활용 정보를",
        [
            "【답변｜파랑｜상태: 미구현】블로그/콘텐츠 모듈은 없습니다. 1차는 정적 소개 글로 시작, 이후 CMS 가능. 일정·리소스 확인 후 착수.",
        ],
    ),
    (
        "- 사용자가 직접 만든 박스를",
        [
            "【답변｜파랑｜상태: 미구현】커뮤니티 공유는 미구현입니다. 블로그 공개 연동과 함께 설계하는 편이 안전합니다(저작권·노출 권한 필요).",
        ],
    ),
    (
        "- 제품별로 박스에 반드시 표시해야 하는",
        [
            "【답변｜파랑｜가능(확인 후)】KC 마크·인증번호 등 ‘필수 표기 레이어/스탬프’로 넣을 수 있습니다. 표기 문구·위치 규정 리스트가 필요합니다.",
        ],
    ),
    (
        "- 박스 도면 위에 디자인을 올리면",
        [
            "【답변｜파랑｜조사】Pacdora: PDF/.ai 올리면 자동 3D+전개도 생성은 공개 기능으로 확인되지 않음. 있는 것은 템플릿+그림→3D, SVG/DXF 칼선 업로드→접어 3D, 작업 후 PDF/AI 내보내기. Packative: 박스 선택·디자인/AI 시안·3D가 중심, CAD는 DXF 가져오기; PDF/.ai 자동 전개+3D는 표준 매력으로 확인되지 않음. BOXCRAFT: 도면 위 디자인→3D는 이미 있음. PDF/.ai 자동은 후순위, 필요 시 SVG/DXF부터.",
            "【답변｜파랑｜안정성】PDF/.ai를 임의로 넣어 자동 3D·전개도를 만들면 모델이 어긋날 수 있습니다. 인쇄 그림·글자·가이드가 섞이고, 칼선/접선·뚜껑 면 등 표준 표기가 없어 안정 인식이 어렵습니다. 데모·반자동은 가능해도 전자동 양산 안정은 기대하기 어렵고, 템플릿(또는 깨끗한 SVG/DXF 칼선) 경로가 더 안전합니다.",
        ],
    ),
    (
        "- 박스를 제작하면, 수량에 따른",
        [
            "【답변｜파랑｜일정 조정】지금은 구독제로 먼저 테스트하고 유입·사용량을 봅니다. 수량별 자동 단가·장바구니·견적은 미뤄 두고, 사이트가 커진 뒤 한국 공급사와 실제 종이박스 판매로 확장할 때 다시 잡습니다.",
        ],
    ),
    (
        "- 포장박스가 만들어지면, 이를 담을 아웃박스",
        [
            "【답변｜파랑｜상태: 구현됨】스튜디오 Outbox(적재·grow/fixed·유도) 있음. UX 카피(“이 박스 10개가 들어가는 아웃박스…”)를 더 명확히 하겠습니다.",
        ],
    ),
    (
        "- AI를 적용할 수 있는지 확인한다",
        [
            "【답변｜파랑｜쉬운 설명】AI는 사이트 안의 ‘도우미’입니다. 손님이 말로 물으면 박스·디자인 팁을 도와줍니다. BOXCRAFT에 AI 대화창이 이미 있고 API만 연결하면 됩니다. Packative처럼 ‘키워드로 그림 시안 생성’은 나중에도 가능. 1차는 질문·조언형 AI를 살립니다.",
        ],
    ),
    (
        "- 설계 중 문제가 될 수 있는 내용을",
        [
            "【답변｜파랑｜쉬운 설명】이건 AI보다 ‘미리 적어 둔 주의 문구’에 가깝습니다. 종이 너무 얇은데 물건이 무겁거나 박스가 너무 높으면 “찌그러질 수 있어요” 안내를 띄웁니다. 한국 지종 표만 있으면 바로 넣을 수 있습니다.",
        ],
    ),
    (
        "- 이 웹사이트를 통해 한국의 파트너",
        [
            "【답변｜파랑｜상태: 미구현(추후)】지금은 구독제만 먼저. 사이트 성장 후 한국 공급사와 실물 박스 판매·발주로 확장하고, 그때 장바구니·견적·발주 상태를 본격 붙입니다.",
        ],
    ),
    (
        "- 인쇄소와 협의하여 아웃박스까지",
        [
            "【답변｜파랑｜추후】2단계(실물 판매) 범위. 아웃박스 설계 데이터는 이미 있어 공급사 SKU만 붙이면 됨. 장바구니·견적은 그때 고도화.",
        ],
    ),
    (
        "- MASSCONNEDTED에서 제품의 크기가",
        [
            "【답변｜파랑｜상태: 미연동】코드베이스에 MASSCONNECTED 연동 없음. 제품 L/W/H API로 박스 엔진 호출하는 계약만 정하면 연결 가능.",
        ],
    ),
    (
        "- 가입하면 10번은 무료로",
        [
            "【답변｜파랑｜전략】1단계(지금): 구독제로 물 테스트—가입·무료 횟수·유료/연간으로 도구 사용권을 팔고 트래픽을 봅니다. 2단계(성장 후): 한국 공급사와 실제 종이박스 판매·제작. 장바구니·견적은 2단계로 미룹니다.",
            "【답변｜파랑｜상태: 미구현】다운로드 횟수·유료벽 없음. 계정별 export 카운터 + 결제 연동으로 구현 가능. 결제(한국 PG) 확정 필요. ← 구독제 1단계 핵심.",
        ],
    ),
    (
        "→ 그 이후에는 5,000원",
        [
            "【답변｜파랑】단가 모델(회당 5,000원+VAT / 연간 3,000원+VAT) 반영 가능. 결제·세금계산 정책 확정 후 적용.",
        ],
    ),
    (
        "- 1년 구독을 하면 3,000원",
        [
            "【답변｜파랑】연간 구독 플랜으로 설계 가능. 1년 후 20% 인상 규칙은 설정값으로 관리.",
        ],
    ),
    (
        "- 주변 사람을 추천하면",
        [
            "【답변｜파랑｜가능】추천인 +3개월 / 피추천 +1개월 쿠폰·기간 연장으로 구현 가능. 무료만 쓰는 비율이 높을 수 있어( PACDORA <8% 전환 참고) 대학생 타깃 콘텐츠·블로그 쿠폰과 묶는 것을 권장.",
        ],
    ),
    (
        "- 무료 10번 중에 자신이 이 사이트로",
        [
            "【답변｜파랑｜가능】블로그 게시 인증 후 1개월 쿠폰 발급 가능. 블로그 모듈 또는 외부 URL 제출+검수 플로우가 선행되어야 합니다.",
        ],
    ),
]


def para_text(p: ET.Element) -> str:
    return "".join((t.text or "") for t in p.iter(f"{W}t"))


def make_blue_paragraph(text: str, template: ET.Element) -> ET.Element:
    p = ET.Element(f"{W}p")
    # copy paragraph properties lightly if present
    pPr_src = template.find(f"{W}pPr")
    if pPr_src is not None:
        p.append(copy.deepcopy(pPr_src))
    r = ET.SubElement(p, f"{W}r")
    rPr = ET.SubElement(r, f"{W}rPr")
    color = ET.SubElement(rPr, f"{W}color")
    color.set(f"{W}val", "0070C0")
    b = ET.SubElement(rPr, f"{W}b")
    sz = ET.SubElement(rPr, f"{W}sz")
    sz.set(f"{W}val", "20")
    szCs = ET.SubElement(rPr, f"{W}szCs")
    szCs.set(f"{W}val", "20")
    t = ET.SubElement(r, f"{W}t")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    return p


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"missing {SRC}")
    shutil.copy2(SRC, DST)

    with ZipFile(DST, "r") as zin:
        xml = zin.read("word/document.xml")
        others = {n: zin.read(n) for n in zin.namelist() if n != "word/document.xml"}

    root = ET.fromstring(xml)
    body = root.find(f"{W}body")
    if body is None:
        raise SystemExit("no body")

    children = list(body)
    # Find sectPr at end
    sect = None
    if children and children[-1].tag == f"{W}sectPr":
        sect = children[-1]
        children = children[:-1]

    new_children: list[ET.Element] = []
    used = set()
    for p in children:
        new_children.append(p)
        if p.tag != f"{W}p":
            continue
        text = para_text(p).strip()
        if not text:
            continue
        for marker, replies in REPLIES:
            if marker in used:
                continue
            if text.startswith(marker) or marker in text[: max(40, len(marker) + 5)]:
                for reply in replies:
                    new_children.append(make_blue_paragraph(reply, p))
                used.add(marker)
                break

    # Append summary block at end
    summary = [
        "【답변｜파랑｜종합 현황】",
        "1단계(지금): 구독제 테스트—무료횟수·유료/연간. 장바구니·견적은 후순위.",
        "2단계(성장 후): 한국 공급사와 실물 종이박스 판매·제작. 그때 장바구니·견적·발주.",
        "우선 기능: 한국 지종·두께·안밖치수 UI, 초보자 위험 안내, 예시 디자인 원클릭.",
        "후순위: PDF/.ai 자동 3D, 블로그·커뮤니티, KC, MASSCONNECTED.",
        "HTML 답변본: BOXCRAFT_주요필요사항_1차_261114_답변.html",
    ]
    anchor = new_children[-1] if new_children else ET.Element(f"{W}p")
    for line in summary:
        new_children.append(make_blue_paragraph(line, anchor))

    body.clear()
    for c in new_children:
        body.append(c)
    if sect is not None:
        body.append(sect)

    ET.register_namespace("w", NSMAP["w"])
    # Keep other namespaces from original root
    out_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    with ZipFile(DST, "w", ZIP_DEFLATED) as zout:
        for name, data in others.items():
            zout.writestr(name, data)
        zout.writestr("word/document.xml", out_xml)

    missing = [m for m, _ in REPLIES if m not in used]
    print(f"wrote {DST}")
    print(f"matched {len(used)}/{len(REPLIES)}")
    if missing:
        print("unmatched markers:")
        for m in missing:
            print(" -", m)


if __name__ == "__main__":
    main()
