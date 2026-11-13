/** auto-generated — modelOnly flags applied */
export default {
  "schema": "boxcraft.presets.v1",
  "note": "Imported SIZE directory (shipping + mailer). Geometry under public/*-geom is locked-sample playback reference, not production dielines. Engine regenerates via BOXCRAFT templates when no geom.",
  "generatedFrom": [
    "docs\\pacdora_shipping_boxes\\shipping_boxes.csv",
    "docs\\pacdora_mailer_boxes\\mailer_boxes.csv"
  ],
  "count": 126,
  "mapped": 112,
  "missingGeom": 0,
  "byTemplate": {
    "spec-PairBuckletriple": 1,
    "spec-PairBuckletripleBackward": 1,
    "fefco-0427": 39,
    "tuck-end-straight": 10,
    "spec-SplitLockBuckleBottomBox": 1,
    "spec-SplitLockselflockingBox": 1,
    "handle-box": 5,
    "spec-TearOffCableFlatBox": 1,
    "spec-BottomInsertingBoxWithHalfSelfLockingUpperCover": 1,
    "spec-BuckleBottomBoxWithInsertion": 1,
    "spec-FlapBotselflock": 1,
    "tuck-end-reverse": 1,
    "unmapped": 14,
    "spec-RoofflatHandleBuckleBackward": 1,
    "spec-RoofflatHandleBuckletriple": 1,
    "spec-RoofflatHandleBuckletripleBackward": 1,
    "spec-FlatMouthSpecialLockBottom": 1,
    "spec-InterlockPortableTrayCase": 1,
    "mailer-parametric-demo": 4,
    "spec-FlapBoxWithTopLatchTwo": 1,
    "spec-NonSlotLockBottomFlipBox": 2,
    "mailer-aircraft": 2,
    "spec-ZipperShapedAirplaneCase": 1,
    "spec-FlipSidePlugUnbonded": 1,
    "lid-base": 1,
    "fefco-0201": 4,
    "spec-CartonHandhole": 1,
    "spec-CartonRegular0209": 1,
    "spec-RegularCartonWithHandleHoles": 1,
    "spec-InsideCornerFlatCarton": 1,
    "spec-RegularCardboardBoxABSurface": 1,
    "spec-RegularCartonFourPieces": 1,
    "spec-Carton02": 1,
    "spec-Carton03": 1,
    "spec-CartonFrontZipper": 1,
    "spec-InsideCornerZipperCarton": 1,
    "spec-CartonEconomic": 1,
    "spec-CartonEconomicHandhole": 1,
    "spec-CartonSelfBlock": 1,
    "spec-CartonMovehouseStrengthen": 1,
    "spec-CartonSelfSixBlock": 1,
    "spec-SixCompartmentLinedCarton": 1,
    "spec-SixCompartmentLinedSelflockingBottomFlatCarton": 1,
    "spec-CartonFlatWithFlipLatch": 1,
    "spec-Carton04": 1,
    "spec-BottomCardboardBoxABSurface": 1,
    "spec-BottomLessCoverCardboardBox": 1,
    "spec-CartonHandholeCoverbox": 1,
    "spec-BreatherHoleCoverbox": 1,
    "spec-MediumSealedCardboardBox": 2,
    "spec-TrayTypeCarton": 2,
    "spec-NonStickTrayBottomMatchingBox": 1
  },
  "byCategory": {
    "shipping": 47,
    "mailer": 79
  },
  "categories": [
    {
      "id": "shipping",
      "label": "运输箱",
      "count": 47
    },
    {
      "id": "mailer",
      "label": "邮寄盒",
      "count": 79
    }
  ],
  "presets": [
    {
      "id": "import-shipping-102040",
      "sourceNum": "102040",
      "label": "插口式产品盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 150,
      "height": 181.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-PairBuckletriple",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 458.5,
      "geomRel": "shipping-geom/102040.json",
      "geomPublicRel": "shipping-geom/102040.json",
      "coverRel": "shipping-covers/102040.png",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "PairBuckletriple",
      "specFrom": "tuck-end-straight",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-102041",
      "sourceNum": "102041",
      "label": "自动底部三扣底邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-PairBuckletripleBackward",
      "hasGeometry": true,
      "cutCount": 76,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 465,
      "geomRel": "shipping-geom/102041.json",
      "geomPublicRel": "shipping-geom/102041.json",
      "coverRel": "shipping-covers/102041.png",
      "subclassIds": [
        "shipping",
        "mailer"
      ],
      "subclassLabels": [
        "运输箱",
        "邮寄盒"
      ],
      "structureCode": "PairBuckletripleBackward",
      "specFrom": "fefco-0427",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-102060",
      "sourceNum": "102060",
      "label": "Mailer box with double safety buckles positive",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 100,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 123,
      "foldCount": 18,
      "sheetW": 852,
      "sheetH": 382,
      "geomRel": "mailer-geom/102060.json",
      "geomPublicRel": "mailer-geom/102060.json",
      "coverRel": "mailer-covers/102060.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-102061",
      "sourceNum": "102061",
      "label": "Mailer box with double safety buckles auto lock bottom",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 100,
      "height": 180.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 108,
      "foldCount": 20,
      "sheetW": 852,
      "sheetH": 390.5,
      "geomRel": "mailer-geom/102061.json",
      "geomPublicRel": "mailer-geom/102061.json",
      "coverRel": "mailer-covers/102061.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-102063",
      "sourceNum": "102063",
      "label": "Tuck end mailer box with security buckles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 100,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 132,
      "foldCount": 22,
      "sheetW": 852,
      "sheetH": 382,
      "geomRel": "mailer-geom/102063.json",
      "geomPublicRel": "mailer-geom/102063.json",
      "coverRel": "mailer-covers/102063.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-102064",
      "sourceNum": "102064",
      "label": "Mailer box with auto bottome snap lock",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 125,
      "foldCount": 20,
      "sheetW": 1052,
      "sheetH": 550,
      "geomRel": "mailer-geom/102064.json",
      "geomPublicRel": "mailer-geom/102064.json",
      "coverRel": "mailer-covers/102064.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-102220",
      "sourceNum": "102220",
      "label": "Mailer box with security buckles auto bottome snap lock",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 100,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 100,
      "foldCount": 18,
      "sheetW": 852,
      "sheetH": 402.25,
      "geomRel": "mailer-geom/102220.json",
      "geomPublicRel": "mailer-geom/102220.json",
      "coverRel": "mailer-covers/102220.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-shipping-103020",
      "sourceNum": "103020",
      "label": "双开运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SplitLockBuckleBottomBox",
      "hasGeometry": true,
      "cutCount": 81,
      "foldCount": 16,
      "sheetW": 672,
      "sheetH": 346,
      "geomRel": "shipping-geom/103020.json",
      "geomPublicRel": "shipping-geom/103020.json",
      "coverRel": "shipping-covers/103020.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "SplitLockBuckleBottomBox",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-103021",
      "sourceNum": "103021",
      "label": "双开运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SplitLockselflockingBox",
      "hasGeometry": true,
      "cutCount": 95,
      "foldCount": 18,
      "sheetW": 672,
      "sheetH": 355,
      "geomRel": "shipping-geom/103021.json",
      "geomPublicRel": "shipping-geom/103021.json",
      "coverRel": "shipping-covers/103021.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "SplitLockselflockingBox",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-103090",
      "sourceNum": "103090",
      "label": "Back open mailer box with handles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 202,
      "width": 137,
      "height": 125,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "handle-box",
      "hasGeometry": true,
      "cutCount": 118,
      "foldCount": 18,
      "sheetW": 710,
      "sheetH": 390.5,
      "geomRel": "mailer-geom/103090.json",
      "geomPublicRel": "mailer-geom/103090.json",
      "coverRel": "mailer-covers/103090.png",
      "subclassIds": [
        "mailer",
        "handle"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带手柄的盒子"
      ]
    },
    {
      "id": "import-mailer-109020",
      "sourceNum": "109020",
      "label": "Flip top tuck front mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 161.5,
      "width": 60,
      "height": 204.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 66,
      "foldCount": 12,
      "sheetW": 507,
      "sheetH": 327,
      "geomRel": "mailer-geom/109020.json",
      "geomPublicRel": "mailer-geom/109020.json",
      "coverRel": "mailer-covers/109020.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-110160",
      "sourceNum": "110160",
      "label": "FEFCO 0227  tuck end mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 120,
      "width": 60,
      "height": 160,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 16,
      "sheetW": 383,
      "sheetH": 292,
      "geomRel": "mailer-geom/110160.json",
      "geomPublicRel": "mailer-geom/110160.json",
      "coverRel": "mailer-covers/110160.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-shipping-110171",
      "sourceNum": "110171",
      "label": "带撕线的运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 291,
      "height": 193,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-TearOffCableFlatBox",
      "hasGeometry": true,
      "cutCount": 239,
      "foldCount": 13,
      "sheetW": 935,
      "sheetH": 506,
      "geomRel": "shipping-geom/110171.json",
      "geomPublicRel": "shipping-geom/110171.json",
      "coverRel": "shipping-covers/110171.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "TearOffCableFlatBox",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-110680",
      "sourceNum": "110680",
      "label": "方形运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 100,
      "height": 100,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "spec-BottomInsertingBoxWithHalfSelfLockingUpperCover",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 12,
      "sheetW": 520.9,
      "sheetH": 321.04999999999995,
      "geomRel": "shipping-geom/110680.json",
      "geomPublicRel": "shipping-geom/110680.json",
      "coverRel": "shipping-covers/110680.png",
      "subclassIds": [
        "shipping",
        "square"
      ],
      "subclassLabels": [
        "运输箱",
        "方形盒"
      ],
      "structureCode": "BottomInsertingBoxWithHalfSelfLockingUpperCover",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-110810",
      "sourceNum": "110810",
      "label": "插舌式运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 100,
      "height": 150,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BuckleBottomBoxWithInsertion",
      "hasGeometry": true,
      "cutCount": 67,
      "foldCount": 20,
      "sheetW": 879.5,
      "sheetH": 291,
      "geomRel": "shipping-geom/110810.json",
      "geomPublicRel": "shipping-geom/110810.json",
      "coverRel": "shipping-covers/110810.png",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "BuckleBottomBoxWithInsertion",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-112010",
      "sourceNum": "112010",
      "label": "平邮箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 120,
      "width": 60,
      "height": 160.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "spec-FlapBotselflock",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 14,
      "sheetW": 377.9,
      "sheetH": 240.2,
      "geomRel": "shipping-geom/112010.json",
      "geomPublicRel": "shipping-geom/112010.json",
      "coverRel": "shipping-covers/112010.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "FlapBotselflock",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-112050",
      "sourceNum": "112050",
      "label": "Tuck end mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 120,
      "width": 60,
      "height": 160.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 52,
      "foldCount": 12,
      "sheetW": 377.9,
      "sheetH": 238.2,
      "geomRel": "mailer-geom/112050.json",
      "geomPublicRel": "mailer-geom/112050.json",
      "coverRel": "mailer-covers/112050.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-112322",
      "sourceNum": "112322",
      "label": "Mailer box with safety buckle",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 101,
      "foldCount": 21,
      "sheetW": 952,
      "sheetH": 487.75,
      "geomRel": "mailer-geom/112322.json",
      "geomPublicRel": "mailer-geom/112322.json",
      "coverRel": "mailer-covers/112322.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112330",
      "sourceNum": "112330",
      "label": "Mailer box with auto lock buckles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 19,
      "sheetW": 952,
      "sheetH": 466.5,
      "geomRel": "mailer-geom/112330.json",
      "geomPublicRel": "mailer-geom/112330.json",
      "coverRel": "mailer-covers/112330.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112331",
      "sourceNum": "112331",
      "label": "Reverse tuck end mailer boxes",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 182,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-reverse",
      "hasGeometry": true,
      "cutCount": 122,
      "foldCount": 24,
      "sheetW": 952,
      "sheetH": 466.5,
      "geomRel": "mailer-geom/112331.json",
      "geomPublicRel": "mailer-geom/112331.json",
      "coverRel": "mailer-covers/112331.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-112350",
      "sourceNum": "112350",
      "label": "Auto lock bottom mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 104,
      "foldCount": 21,
      "sheetW": 952,
      "sheetH": 487.75,
      "geomRel": "mailer-geom/112350.json",
      "geomPublicRel": "mailer-geom/112350.json",
      "coverRel": "mailer-covers/112350.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112360",
      "sourceNum": "112360",
      "label": "Security buckles flat top cartons mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 79,
      "foldCount": 19,
      "sheetW": 952,
      "sheetH": 443.75,
      "geomRel": "mailer-geom/112360.json",
      "geomPublicRel": "mailer-geom/112360.json",
      "coverRel": "mailer-covers/112360.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-112372",
      "sourceNum": "112372",
      "label": "Roof mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 173,
      "width": 113,
      "height": 91.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 89,
      "foldCount": 27,
      "sheetW": 598,
      "sheetH": 341.5,
      "geomRel": "mailer-geom/112372.json",
      "geomPublicRel": "mailer-geom/112372.json",
      "coverRel": "mailer-covers/112372.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112430",
      "sourceNum": "112430",
      "label": "Mailer box with adhesive opening and handles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 150,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "handle-box",
      "hasGeometry": true,
      "cutCount": 70,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 411.5,
      "geomRel": "mailer-geom/112430.json",
      "geomPublicRel": "mailer-geom/112430.json",
      "coverRel": "mailer-covers/112430.png",
      "subclassIds": [
        "mailer",
        "handle"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带手柄的盒子"
      ]
    },
    {
      "id": "import-mailer-112431",
      "sourceNum": "112431",
      "label": "Mailer box with adhesive opening and handles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 147,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "handle-box",
      "hasGeometry": true,
      "cutCount": 52,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 456,
      "geomRel": "mailer-geom/112431.json",
      "geomPublicRel": "mailer-geom/112431.json",
      "coverRel": "mailer-covers/112431.png",
      "subclassIds": [
        "mailer",
        "handle"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带手柄的盒子"
      ]
    },
    {
      "id": "import-mailer-112450",
      "sourceNum": "112450",
      "label": "Carrying mailer box auto bottome snap lock boxes",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 130,
      "foldCount": 24,
      "sheetW": 892,
      "sheetH": 435.5,
      "geomRel": "mailer-geom/112450.json",
      "geomPublicRel": "mailer-geom/112450.json",
      "coverRel": "mailer-covers/112450.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-112451",
      "sourceNum": "112451",
      "label": "Mailer box with double snap locks and handles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 120,
      "height": 182.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "handle-box",
      "hasGeometry": true,
      "cutCount": 144,
      "foldCount": 22,
      "sheetW": 892,
      "sheetH": 417.5,
      "geomRel": "mailer-geom/112451.json",
      "geomPublicRel": "mailer-geom/112451.json",
      "coverRel": "mailer-covers/112451.png",
      "subclassIds": [
        "mailer",
        "tuck",
        "handle"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒",
        "带手柄的盒子"
      ]
    },
    {
      "id": "import-shipping-112470",
      "sourceNum": "112470",
      "label": "扣锁礼品运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 202.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 93,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "shipping-geom/112470.json",
      "geomPublicRel": "shipping-geom/112470.json",
      "coverRel": "shipping-covers/112470.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RoofflatHandleBuckle"
    },
    {
      "id": "import-shipping-112471",
      "sourceNum": "112471",
      "label": "扣锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 202.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckleBackward",
      "hasGeometry": true,
      "cutCount": 93,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "shipping-geom/112471.json",
      "geomPublicRel": "shipping-geom/112471.json",
      "coverRel": "shipping-covers/112471.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RoofflatHandleBuckleBackward",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-112480",
      "sourceNum": "112480",
      "label": "三锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckletriple",
      "hasGeometry": true,
      "cutCount": 106,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "shipping-geom/112480.json",
      "geomPublicRel": "shipping-geom/112480.json",
      "coverRel": "shipping-covers/112480.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RoofflatHandleBuckletriple",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-112481",
      "sourceNum": "112481",
      "label": "反锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckletripleBackward",
      "hasGeometry": true,
      "cutCount": 107,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "shipping-geom/112481.json",
      "geomPublicRel": "shipping-geom/112481.json",
      "coverRel": "shipping-covers/112481.png",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "RoofflatHandleBuckletripleBackward",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-112500",
      "sourceNum": "112500",
      "label": "Mailer box with double safety buckles lock inserts",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 127,
      "foldCount": 23,
      "sheetW": 892,
      "sheetH": 417,
      "geomRel": "mailer-geom/112500.json",
      "geomPublicRel": "mailer-geom/112500.json",
      "coverRel": "mailer-covers/112500.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-shipping-112511",
      "sourceNum": "112511",
      "label": "插口运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 100,
      "height": 300,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlatMouthSpecialLockBottom",
      "hasGeometry": true,
      "cutCount": 58,
      "foldCount": 16,
      "sheetW": 860,
      "sheetH": 468,
      "geomRel": "shipping-geom/112511.json",
      "geomPublicRel": "shipping-geom/112511.json",
      "coverRel": "shipping-covers/112511.png",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "FlatMouthSpecialLockBottom",
      "specFrom": "tuck-end-straight",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-112550",
      "sourceNum": "112550",
      "label": "Mailer box with security buckles lock inserts",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 200,
      "width": 100,
      "height": 150,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 99,
      "foldCount": 23,
      "sheetW": 642,
      "sheetH": 398.5,
      "geomRel": "mailer-geom/112550.json",
      "geomPublicRel": "mailer-geom/112550.json",
      "coverRel": "mailer-covers/112550.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112580",
      "sourceNum": "112580",
      "label": "Dust-proof locking mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 150,
      "height": 200,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 122,
      "foldCount": 25,
      "sheetW": 952,
      "sheetH": 493,
      "geomRel": "mailer-geom/112580.json",
      "geomPublicRel": "mailer-geom/112580.json",
      "coverRel": "mailer-covers/112580.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-112690",
      "sourceNum": "112690",
      "label": "Tuck end mailer box with lock bottom",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 100,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 117,
      "foldCount": 25,
      "sheetW": 852,
      "sheetH": 398.25,
      "geomRel": "mailer-geom/112690.json",
      "geomPublicRel": "mailer-geom/112690.json",
      "coverRel": "mailer-covers/112690.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-shipping-116200",
      "sourceNum": "116200",
      "label": "带手柄的盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 200,
      "height": 150,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InterlockPortableTrayCase",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 17,
      "sheetW": 980,
      "sheetH": 940.5,
      "geomRel": "shipping-geom/116200.json",
      "geomPublicRel": "shipping-geom/116200.json",
      "coverRel": "shipping-covers/116200.png",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "InterlockPortableTrayCase",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-150010",
      "sourceNum": "150010",
      "label": "Rollover hinged lid mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "mailer-parametric-demo",
      "hasGeometry": true,
      "cutCount": 89,
      "foldCount": 22,
      "sheetW": 576,
      "sheetH": 590,
      "geomRel": "mailer-geom/150010.json",
      "geomPublicRel": "mailer-geom/150010.json",
      "coverRel": "mailer-covers/150010.png",
      "subclassIds": [
        "mailer",
        "lid"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带盖盒"
      ]
    },
    {
      "id": "import-mailer-150011",
      "sourceNum": "150011",
      "label": "FEFCO 0427 flip top mailer box packaging",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 87,
      "foldCount": 22,
      "sheetW": 590,
      "sheetH": 576,
      "geomRel": "mailer-geom/150011.json",
      "geomPublicRel": "mailer-geom/150011.json",
      "coverRel": "mailer-covers/150011.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150012",
      "sourceNum": "150012",
      "label": "Flip top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 89,
      "foldCount": 22,
      "sheetW": 590,
      "sheetH": 576,
      "geomRel": "mailer-geom/150012.json",
      "geomPublicRel": "mailer-geom/150012.json",
      "coverRel": "mailer-covers/150012.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150013",
      "sourceNum": "150013",
      "label": "Mailer box with security buckles flip top",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 106,
      "foldCount": 27,
      "sheetW": 618.5,
      "sheetH": 574,
      "geomRel": "mailer-geom/150013.json",
      "geomPublicRel": "mailer-geom/150013.json",
      "coverRel": "mailer-covers/150013.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150014",
      "sourceNum": "150014",
      "label": "Mailer box with Double safety buckles",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 126,
      "foldCount": 32,
      "sheetW": 618.5,
      "sheetH": 574,
      "geomRel": "mailer-geom/150014.json",
      "geomPublicRel": "mailer-geom/150014.json",
      "coverRel": "mailer-covers/150014.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150016",
      "sourceNum": "150016",
      "label": "Mailer box with handle hole box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298.6,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "handle-box",
      "hasGeometry": true,
      "cutCount": 99,
      "foldCount": 26,
      "sheetW": 563,
      "sheetH": 585.2,
      "geomRel": "mailer-geom/150016.json",
      "geomPublicRel": "mailer-geom/150016.json",
      "coverRel": "mailer-covers/150016.png",
      "subclassIds": [
        "mailer",
        "handle"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带手柄的盒子"
      ]
    },
    {
      "id": "import-mailer-150017",
      "sourceNum": "150017",
      "label": "Mailer box carrying cases",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 87,
      "foldCount": 22,
      "sheetW": 590,
      "sheetH": 574,
      "geomRel": "mailer-geom/150017.json",
      "geomPublicRel": "mailer-geom/150017.json",
      "coverRel": "mailer-covers/150017.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150018",
      "sourceNum": "150018",
      "label": "Flip top box mailer carrying cases",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 304,
      "width": 201,
      "height": 61,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 106,
      "foldCount": 27,
      "sheetW": 619,
      "sheetH": 570,
      "geomRel": "mailer-geom/150018.json",
      "geomPublicRel": "mailer-geom/150018.json",
      "coverRel": "mailer-covers/150018.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150020",
      "sourceNum": "150020",
      "label": "FEFCO 0429 flip top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 20,
      "sheetW": 585.5,
      "sheetH": 574,
      "geomRel": "mailer-geom/150020.json",
      "geomPublicRel": "mailer-geom/150020.json",
      "coverRel": "mailer-covers/150020.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150021",
      "sourceNum": "150021",
      "label": "Mailer box with window",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 80,
      "foldCount": 20,
      "sheetW": 585.5,
      "sheetH": 572,
      "geomRel": "mailer-geom/150021.json",
      "geomPublicRel": "mailer-geom/150021.json",
      "coverRel": "mailer-covers/150021.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-150023",
      "sourceNum": "150023",
      "label": "Three side double wall flip top box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 285,
      "width": 191.5,
      "height": 58,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 148,
      "foldCount": 26,
      "sheetW": 553,
      "sheetH": 639,
      "geomRel": "mailer-geom/150023.json",
      "geomPublicRel": "mailer-geom/150023.json",
      "coverRel": "mailer-covers/150023.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150030",
      "sourceNum": "150030",
      "label": "Flip top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 295,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 87,
      "foldCount": 20,
      "sheetW": 590,
      "sheetH": 568,
      "geomRel": "mailer-geom/150030.json",
      "geomPublicRel": "mailer-geom/150030.json",
      "coverRel": "mailer-covers/150030.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150032",
      "sourceNum": "150032",
      "label": "Flip top insert lock mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200.5,
      "height": 50,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 102,
      "foldCount": 26,
      "sheetW": 536.5,
      "sheetH": 620.75,
      "geomRel": "mailer-geom/150032.json",
      "geomPublicRel": "mailer-geom/150032.json",
      "coverRel": "mailer-covers/150032.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150100",
      "sourceNum": "150100",
      "label": "Self-locking angled front mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 285,
      "width": 198,
      "height": 58,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 152,
      "foldCount": 28,
      "sheetW": 553,
      "sheetH": 536.80829,
      "geomRel": "mailer-geom/150100.json",
      "geomPublicRel": "mailer-geom/150100.json",
      "coverRel": "mailer-covers/150100.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150160",
      "sourceNum": "150160",
      "label": "Flip top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 111,
      "foldCount": 22,
      "sheetW": 590,
      "sheetH": 574,
      "geomRel": "mailer-geom/150160.json",
      "geomPublicRel": "mailer-geom/150160.json",
      "coverRel": "mailer-covers/150160.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-150300",
      "sourceNum": "150300",
      "label": "Tuck end mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 125,
      "height": 50,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 130,
      "foldCount": 18,
      "sheetW": 509,
      "sheetH": 402.5,
      "geomRel": "mailer-geom/150300.json",
      "geomPublicRel": "mailer-geom/150300.json",
      "coverRel": "mailer-covers/150300.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-150430",
      "sourceNum": "150430",
      "label": "Flip top box side mailer",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 315,
      "width": 202,
      "height": 202,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 138,
      "foldCount": 41,
      "sheetW": 876,
      "sheetH": 816,
      "geomRel": "mailer-geom/150430.json",
      "geomPublicRel": "mailer-geom/150430.json",
      "coverRel": "mailer-covers/150430.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-151030",
      "sourceNum": "151030",
      "label": "Flip top tuck front mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 100,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 126,
      "foldCount": 30,
      "sheetW": 620,
      "sheetH": 753.5,
      "geomRel": "mailer-geom/151030.json",
      "geomPublicRel": "mailer-geom/151030.json",
      "coverRel": "mailer-covers/151030.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-151220",
      "sourceNum": "151220",
      "label": "Flip top mailer box with lock inserts round head",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 120,
      "width": 180,
      "height": 100,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 16,
      "sheetW": 474.9,
      "sheetH": 422.79999999999995,
      "geomRel": "mailer-geom/151220.json",
      "geomPublicRel": "mailer-geom/151220.json",
      "coverRel": "mailer-covers/151220.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-152010",
      "sourceNum": "152010",
      "label": "FEFCO 0420 flip top tuck front mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 147.4,
      "width": 99.4,
      "height": 59.4,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 12,
      "sheetW": 301,
      "sheetH": 344,
      "geomRel": "mailer-geom/152010.json",
      "geomPublicRel": "mailer-geom/152010.json",
      "coverRel": "mailer-covers/152010.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-152040",
      "sourceNum": "152040",
      "label": "Flip top mailer box with lock",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 150,
      "width": 100,
      "height": 80,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 84,
      "foldCount": 18,
      "sheetW": 352.79999999999995,
      "sheetH": 406.9,
      "geomRel": "mailer-geom/152040.json",
      "geomPublicRel": "mailer-geom/152040.json",
      "coverRel": "mailer-covers/152040.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-152100",
      "sourceNum": "152100",
      "label": "Flip top malier box with lock tab",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 135,
      "width": 133.5,
      "height": 114,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 124,
      "foldCount": 22,
      "sheetW": 370,
      "sheetH": 649.5,
      "geomRel": "mailer-geom/152100.json",
      "geomPublicRel": "mailer-geom/152100.json",
      "coverRel": "mailer-covers/152100.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-152101",
      "sourceNum": "152101",
      "label": "Self locking flip top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 135,
      "width": 133.5,
      "height": 114,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 88,
      "foldCount": 18,
      "sheetW": 370,
      "sheetH": 659.5,
      "geomRel": "mailer-geom/152101.json",
      "geomPublicRel": "mailer-geom/152101.json",
      "coverRel": "mailer-covers/152101.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-shipping-152102",
      "sourceNum": "152102",
      "label": "定制自锁式邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 295,
      "width": 193.5,
      "height": 99,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlapBoxWithTopLatchTwo",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 18,
      "sheetW": 500,
      "sheetH": 737.75,
      "geomRel": "shipping-geom/152102.json",
      "geomPublicRel": "shipping-geom/152102.json",
      "coverRel": "shipping-covers/152102.png",
      "subclassIds": [
        "shipping",
        "mailer"
      ],
      "subclassLabels": [
        "运输箱",
        "邮寄盒"
      ],
      "structureCode": "FlapBoxWithTopLatchTwo",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-153031",
      "sourceNum": "153031",
      "label": "翻盖邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 294,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-NonSlotLockBottomFlipBox",
      "hasGeometry": true,
      "cutCount": 66,
      "foldCount": 18,
      "sheetW": 561,
      "sheetH": 528,
      "geomRel": "shipping-geom/153031.json",
      "geomPublicRel": "shipping-geom/153031.json",
      "coverRel": "shipping-covers/153031.png",
      "subclassIds": [
        "shipping",
        "mailer",
        "lid"
      ],
      "subclassLabels": [
        "运输箱",
        "邮寄盒",
        "带盖盒"
      ],
      "structureCode": "NonSlotLockBottomFlipBox",
      "specFrom": "fefco-0427",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-153031",
      "sourceNum": "153031",
      "label": "FEFCO 0414 flip-top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 294,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "spec-NonSlotLockBottomFlipBox",
      "hasGeometry": true,
      "cutCount": 66,
      "foldCount": 18,
      "sheetW": 561,
      "sheetH": 528,
      "geomRel": "mailer-geom/153031.json",
      "geomPublicRel": "mailer-geom/153031.json",
      "coverRel": "mailer-covers/153031.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "structureCode": "NonSlotLockBottomFlipBox",
      "specFrom": "fefco-0427",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-156000",
      "sourceNum": "156000",
      "label": "FEFCO 0471 flip top mailer box with polygonal tuck front",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 152.5,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "mailer-aircraft",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 18,
      "sheetW": 366.5,
      "sheetH": 455,
      "geomRel": "mailer-geom/156000.json",
      "geomPublicRel": "mailer-geom/156000.json",
      "coverRel": "mailer-covers/156000.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-156001",
      "sourceNum": "156001",
      "label": "Flip top boxes inserts polygonal mailer",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 150,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "mailer-aircraft",
      "hasGeometry": true,
      "cutCount": 79,
      "foldCount": 23,
      "sheetW": 365,
      "sheetH": 633.5,
      "geomRel": "mailer-geom/156001.json",
      "geomPublicRel": "mailer-geom/156001.json",
      "coverRel": "mailer-covers/156001.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-shipping-156090",
      "sourceNum": "156090",
      "label": "打开的纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-ZipperShapedAirplaneCase",
      "hasGeometry": true,
      "cutCount": 145,
      "foldCount": 27,
      "sheetW": 365,
      "sheetH": 455,
      "geomRel": "shipping-geom/156090.json",
      "geomPublicRel": "shipping-geom/156090.json",
      "coverRel": "shipping-covers/156090.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "ZipperShapedAirplaneCase",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-156130",
      "sourceNum": "156130",
      "label": "Flip top mailer box with bottom lock inserts",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 100,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 100,
      "foldCount": 30,
      "sheetW": 722,
      "sheetH": 736,
      "geomRel": "mailer-geom/156130.json",
      "geomPublicRel": "mailer-geom/156130.json",
      "coverRel": "mailer-covers/156130.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-shipping-156131",
      "sourceNum": "156131",
      "label": "带非粘合侧榫锁的运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 200,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlipSidePlugUnbonded",
      "hasGeometry": true,
      "cutCount": 127,
      "foldCount": 30,
      "sheetW": 625.5,
      "sheetH": 735,
      "geomRel": "shipping-geom/156131.json",
      "geomPublicRel": "shipping-geom/156131.json",
      "coverRel": "shipping-covers/156131.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "FlipSidePlugUnbonded",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-156181",
      "sourceNum": "156181",
      "label": "Flip top box with auto lock bottom",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 201,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 24,
      "sheetW": 517,
      "sheetH": 741.5,
      "geomRel": "mailer-geom/156181.json",
      "geomPublicRel": "mailer-geom/156181.json",
      "coverRel": "mailer-covers/156181.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-156280",
      "sourceNum": "156280",
      "label": "Flip top miler box with lock inserts",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 99.75,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 22,
      "sheetW": 565.5,
      "sheetH": 743.75,
      "geomRel": "mailer-geom/156280.json",
      "geomPublicRel": "mailer-geom/156280.json",
      "coverRel": "mailer-covers/156280.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-156281",
      "sourceNum": "156281",
      "label": "Flip top mailer box with zipper",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 99.75,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "lid-base",
      "hasGeometry": true,
      "cutCount": 237,
      "foldCount": 20,
      "sheetW": 565.5,
      "sheetH": 712.25,
      "geomRel": "mailer-geom/156281.json",
      "geomPublicRel": "mailer-geom/156281.json",
      "coverRel": "mailer-covers/156281.png",
      "subclassIds": [
        "mailer",
        "lid"
      ],
      "subclassLabels": [
        "邮寄盒",
        "带盖盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-156310",
      "sourceNum": "156310",
      "label": "Flip top mailer box with bottom lock inserts",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 50,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 110,
      "foldCount": 28,
      "sheetW": 649,
      "sheetH": 566,
      "geomRel": "mailer-geom/156310.json",
      "geomPublicRel": "mailer-geom/156310.json",
      "coverRel": "mailer-covers/156310.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-156410",
      "sourceNum": "156410",
      "label": "Buckle lock bottom carton gift mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 125,
      "width": 120,
      "height": 80,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 120,
      "foldCount": 19,
      "sheetW": 495,
      "sheetH": 539,
      "geomRel": "mailer-geom/156410.json",
      "geomPublicRel": "mailer-geom/156410.json",
      "coverRel": "mailer-covers/156410.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-156650",
      "sourceNum": "156650",
      "label": "Tuck lock mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 198.4,
      "width": 127.5,
      "height": 44.7,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 210,
      "foldCount": 21,
      "sheetW": 290.000001,
      "sheetH": 419,
      "geomRel": "mailer-geom/156650.json",
      "geomPublicRel": "mailer-geom/156650.json",
      "coverRel": "mailer-covers/156650.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-shipping-200010",
      "sourceNum": "200010",
      "label": "0201运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "shipping-geom/200010.json",
      "geomPublicRel": "shipping-geom/200010.json",
      "coverRel": "shipping-covers/200010.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton"
    },
    {
      "id": "import-shipping-200012",
      "sourceNum": "200012",
      "label": "带便携搬运孔的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonHandhole",
      "hasGeometry": true,
      "cutCount": 67,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "shipping-geom/200012.json",
      "geomPublicRel": "shipping-geom/200012.json",
      "coverRel": "shipping-covers/200012.png",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "CartonHandhole",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200013",
      "sourceNum": "200013",
      "label": "0209常规纸质运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonRegular0209",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 440,
      "geomRel": "shipping-geom/200013.json",
      "geomPublicRel": "shipping-geom/200013.json",
      "coverRel": "shipping-covers/200013.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonRegular0209",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200014",
      "sourceNum": "200014",
      "label": "新鲜水果运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCartonWithHandleHoles",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 14,
      "sheetW": 1332,
      "sheetH": 440,
      "geomRel": "shipping-geom/200014.json",
      "geomPublicRel": "shipping-geom/200014.json",
      "coverRel": "shipping-covers/200014.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RegularCartonWithHandleHoles",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200015",
      "sourceNum": "200015",
      "label": "缓冲的运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InsideCornerFlatCarton",
      "hasGeometry": true,
      "cutCount": 32,
      "foldCount": 32,
      "sheetW": 1336,
      "sheetH": 488,
      "geomRel": "shipping-geom/200015.json",
      "geomPublicRel": "shipping-geom/200015.json",
      "coverRel": "shipping-covers/200015.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "InsideCornerFlatCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200016",
      "sourceNum": "200016",
      "label": "纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCardboardBoxABSurface",
      "hasGeometry": true,
      "cutCount": 60,
      "foldCount": 13,
      "sheetW": 693,
      "sheetH": 1028,
      "geomRel": "shipping-geom/200016.json",
      "geomPublicRel": "shipping-geom/200016.json",
      "coverRel": "shipping-covers/200016.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RegularCardboardBoxABSurface",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200017",
      "sourceNum": "200017",
      "label": "纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCartonFourPieces",
      "hasGeometry": true,
      "cutCount": 72,
      "foldCount": 15,
      "sheetW": 778,
      "sheetH": 1028,
      "geomRel": "shipping-geom/200017.json",
      "geomPublicRel": "shipping-geom/200017.json",
      "coverRel": "shipping-covers/200017.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RegularCartonFourPieces",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200020",
      "sourceNum": "200020",
      "label": "纸箱 0202 国际标准",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton02",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 532,
      "geomRel": "shipping-geom/200020.json",
      "geomPublicRel": "shipping-geom/200020.json",
      "coverRel": "shipping-covers/200020.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton02",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200030",
      "sourceNum": "200030",
      "label": "0203 国际标准运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton03",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 710,
      "geomRel": "shipping-geom/200030.json",
      "geomPublicRel": "shipping-geom/200030.json",
      "coverRel": "shipping-covers/200030.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton03",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200034",
      "sourceNum": "200034",
      "label": "带拉链的纸质运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 259,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonFrontZipper",
      "hasGeometry": true,
      "cutCount": 279,
      "foldCount": 41,
      "sheetW": 1336,
      "sheetH": 821,
      "geomRel": "shipping-geom/200034.json",
      "geomPublicRel": "shipping-geom/200034.json",
      "coverRel": "shipping-covers/200034.png",
      "subclassIds": [
        "shipping",
        "lid"
      ],
      "subclassLabels": [
        "运输箱",
        "带盖盒"
      ],
      "structureCode": "CartonFrontZipper",
      "templateSource": "structure-spec",
      "specFrom": "lid-base"
    },
    {
      "id": "import-shipping-200035",
      "sourceNum": "200035",
      "label": "带拉链的运输纸盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InsideCornerZipperCarton",
      "hasGeometry": true,
      "cutCount": 254,
      "foldCount": 63,
      "sheetW": 1336,
      "sheetH": 699,
      "geomRel": "shipping-geom/200035.json",
      "geomPublicRel": "shipping-geom/200035.json",
      "coverRel": "shipping-covers/200035.png",
      "subclassIds": [
        "shipping",
        "lid"
      ],
      "subclassLabels": [
        "运输箱",
        "带盖盒"
      ],
      "structureCode": "InsideCornerZipperCarton",
      "templateSource": "structure-spec",
      "specFrom": "lid-base"
    },
    {
      "id": "import-mailer-200036",
      "sourceNum": "200036",
      "label": "Cardboard mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 399,
      "width": 99,
      "height": 599,
      "thickness": 3,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 46,
      "foldCount": 12,
      "sheetW": 1112,
      "sheetH": 809,
      "geomRel": "mailer-geom/200036.json",
      "geomPublicRel": "mailer-geom/200036.json",
      "coverRel": "mailer-covers/200036.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-shipping-200100",
      "sourceNum": "200100",
      "label": "平顶运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonEconomic",
      "hasGeometry": true,
      "cutCount": 79,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "shipping-geom/200100.json",
      "geomPublicRel": "shipping-geom/200100.json",
      "coverRel": "shipping-covers/200100.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonEconomic",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200102",
      "sourceNum": "200102",
      "label": "带便携孔的运输纸箱ab面",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonEconomicHandhole",
      "hasGeometry": true,
      "cutCount": 83,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "shipping-geom/200102.json",
      "geomPublicRel": "shipping-geom/200102.json",
      "coverRel": "shipping-covers/200102.png",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "CartonEconomicHandhole",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200200",
      "sourceNum": "200200",
      "label": "折叠运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 350,
      "width": 350,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonSelfBlock",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 18,
      "sheetW": 1460,
      "sheetH": 770,
      "geomRel": "shipping-geom/200200.json",
      "geomPublicRel": "shipping-geom/200200.json",
      "coverRel": "shipping-covers/200200.png",
      "subclassIds": [
        "shipping",
        "folding"
      ],
      "subclassLabels": [
        "运输箱",
        "折叠盒"
      ],
      "structureCode": "CartonSelfBlock",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200210",
      "sourceNum": "200210",
      "label": "纸箱移动纸",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 500,
      "width": 400,
      "height": 400,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonMovehouseStrengthen",
      "hasGeometry": true,
      "cutCount": 96,
      "foldCount": 20,
      "sheetW": 1867,
      "sheetH": 1035,
      "geomRel": "shipping-geom/200210.json",
      "geomPublicRel": "shipping-geom/200210.json",
      "coverRel": "shipping-covers/200210.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonMovehouseStrengthen",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200230",
      "sourceNum": "200230",
      "label": "纸箱六格运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 350,
      "width": 200,
      "height": 196,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonSelfSixBlock",
      "hasGeometry": true,
      "cutCount": 56,
      "foldCount": 20,
      "sheetW": 1160,
      "sheetH": 622,
      "geomRel": "shipping-geom/200230.json",
      "geomPublicRel": "shipping-geom/200230.json",
      "coverRel": "shipping-covers/200230.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonSelfSixBlock",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-200231",
      "sourceNum": "200231",
      "label": "6-pack carrier box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 350,
      "width": 200,
      "height": 200,
      "thickness": 3,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 91,
      "foldCount": 20,
      "sheetW": 1144,
      "sheetH": 732,
      "geomRel": "mailer-geom/200231.json",
      "geomPublicRel": "mailer-geom/200231.json",
      "coverRel": "mailer-covers/200231.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-shipping-200240",
      "sourceNum": "200240",
      "label": "带有 6 格插入物的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 198,
      "width": 134,
      "height": 238,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SixCompartmentLinedCarton",
      "hasGeometry": true,
      "cutCount": 98,
      "foldCount": 20,
      "sheetW": 752.5,
      "sheetH": 554,
      "geomRel": "shipping-geom/200240.json",
      "geomPublicRel": "shipping-geom/200240.json",
      "coverRel": "shipping-covers/200240.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "SixCompartmentLinedCarton",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200250",
      "sourceNum": "200250",
      "label": "带6格的折叠运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 199,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SixCompartmentLinedSelflockingBottomFlatCarton",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 20,
      "sheetW": 1050,
      "sheetH": 409,
      "geomRel": "shipping-geom/200250.json",
      "geomPublicRel": "shipping-geom/200250.json",
      "coverRel": "shipping-covers/200250.png",
      "subclassIds": [
        "shipping",
        "folding"
      ],
      "subclassLabels": [
        "运输箱",
        "折叠盒"
      ],
      "structureCode": "SixCompartmentLinedSelflockingBottomFlatCarton",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-200280",
      "sourceNum": "200280",
      "label": "带锁扣插入的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonFlatWithFlipLatch",
      "hasGeometry": true,
      "cutCount": 80,
      "foldCount": 14,
      "sheetW": 632,
      "sheetH": 211,
      "geomRel": "shipping-geom/200280.json",
      "geomPublicRel": "shipping-geom/200280.json",
      "coverRel": "shipping-covers/200280.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonFlatWithFlipLatch",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-201012",
      "sourceNum": "201012",
      "label": "平口运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 206,
      "height": 266.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton04",
      "hasGeometry": true,
      "cutCount": 34,
      "foldCount": 8,
      "sheetW": 1324,
      "sheetH": 376.5,
      "geomRel": "shipping-geom/201012.json",
      "geomPublicRel": "shipping-geom/201012.json",
      "coverRel": "shipping-covers/201012.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton04",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-201013",
      "sourceNum": "201013",
      "label": "无底纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 206,
      "height": 266,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BottomCardboardBoxABSurface",
      "hasGeometry": true,
      "cutCount": 40,
      "foldCount": 9,
      "sheetW": 685,
      "sheetH": 782,
      "geomRel": "shipping-geom/201013.json",
      "geomPublicRel": "shipping-geom/201013.json",
      "coverRel": "shipping-covers/201013.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "BottomCardboardBoxABSurface",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-201015",
      "sourceNum": "201015",
      "label": "无底纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BottomLessCoverCardboardBox",
      "hasGeometry": true,
      "cutCount": 30,
      "foldCount": 8,
      "sheetW": 1336,
      "sheetH": 489.5,
      "geomRel": "shipping-geom/201015.json",
      "geomPublicRel": "shipping-geom/201015.json",
      "coverRel": "shipping-covers/201015.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "BottomLessCoverCardboardBox",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-201080",
      "sourceNum": "201080",
      "label": "带手柄的运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonHandholeCoverbox",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 16,
      "sheetW": 1378,
      "sheetH": 782.5,
      "geomRel": "shipping-geom/201080.json",
      "geomPublicRel": "shipping-geom/201080.json",
      "coverRel": "shipping-covers/201080.png",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "CartonHandholeCoverbox",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-201081",
      "sourceNum": "201081",
      "label": "带通气孔的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BreatherHoleCoverbox",
      "hasGeometry": true,
      "cutCount": 126,
      "foldCount": 24,
      "sheetW": 1378,
      "sheetH": 782.5,
      "geomRel": "shipping-geom/201081.json",
      "geomPublicRel": "shipping-geom/201081.json",
      "coverRel": "shipping-covers/201081.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "BreatherHoleCoverbox",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-205010",
      "sourceNum": "205010",
      "label": "纸板运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-MediumSealedCardboardBox",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 14,
      "sheetW": 457,
      "sheetH": 512,
      "geomRel": "shipping-geom/205010.json",
      "geomPublicRel": "shipping-geom/205010.json",
      "coverRel": "shipping-covers/205010.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "MediumSealedCardboardBox",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-205010",
      "sourceNum": "205010",
      "label": "FEFCO 0411 cardboard shipping box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 3,
      "materialId": "kraft",
      "templateId": "spec-MediumSealedCardboardBox",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 14,
      "sheetW": 457,
      "sheetH": 512,
      "geomRel": "mailer-geom/205010.json",
      "geomPublicRel": "mailer-geom/205010.json",
      "coverRel": "mailer-covers/205010.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "structureCode": "MediumSealedCardboardBox",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-205011",
      "sourceNum": "205011",
      "label": "纸板运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-TrayTypeCarton",
      "hasGeometry": true,
      "cutCount": 42,
      "foldCount": 12,
      "sheetW": 543,
      "sheetH": 522,
      "geomRel": "shipping-geom/205011.json",
      "geomPublicRel": "shipping-geom/205011.json",
      "coverRel": "shipping-covers/205011.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "TrayTypeCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-205011",
      "sourceNum": "205011",
      "label": "FEFCO 0412 cardboard shipping box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 3,
      "materialId": "kraft",
      "templateId": "spec-TrayTypeCarton",
      "hasGeometry": true,
      "cutCount": 42,
      "foldCount": 12,
      "sheetW": 543,
      "sheetH": 522,
      "geomRel": "mailer-geom/205011.json",
      "geomPublicRel": "mailer-geom/205011.json",
      "coverRel": "mailer-covers/205011.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "structureCode": "TrayTypeCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec"
    },
    {
      "id": "import-shipping-206080",
      "sourceNum": "206080",
      "label": "折叠配送箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 120,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-NonStickTrayBottomMatchingBox",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 18,
      "sheetW": 401,
      "sheetH": 495.75,
      "geomRel": "shipping-geom/206080.json",
      "geomPublicRel": "shipping-geom/206080.json",
      "coverRel": "shipping-covers/206080.png",
      "subclassIds": [
        "shipping",
        "folding"
      ],
      "subclassLabels": [
        "运输箱",
        "折叠盒"
      ],
      "structureCode": "NonStickTrayBottomMatchingBox",
      "specFrom": null,
      "templateSource": "structure-spec"
    },
    {
      "id": "import-mailer-206090",
      "sourceNum": "206090",
      "label": "Cardboard mailer box with lock",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 240,
      "width": 180,
      "height": 85,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 69,
      "foldCount": 15,
      "sheetW": 892,
      "sheetH": 386.5,
      "geomRel": "mailer-geom/206090.json",
      "geomPublicRel": "mailer-geom/206090.json",
      "coverRel": "mailer-covers/206090.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-243010",
      "sourceNum": "243010",
      "label": "Envelope sleeves mailer",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 218,
      "width": 14,
      "height": 318,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 57,
      "foldCount": 12,
      "sheetW": 701,
      "sheetH": 492,
      "geomRel": "mailer-geom/243010.json",
      "geomPublicRel": "mailer-geom/243010.json",
      "coverRel": "mailer-covers/243010.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-360101",
      "sourceNum": "360101",
      "label": "Luxury rigid box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 180,
      "width": 100,
      "height": 40,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 22,
      "sheetW": 425,
      "sheetH": 109.45,
      "geomRel": "mailer-geom/360101.json",
      "geomPublicRel": "mailer-geom/360101.json",
      "coverRel": "mailer-covers/360101.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-361011",
      "sourceNum": "361011",
      "label": "Flip top magnetic gift box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 180,
      "width": 100,
      "height": 40,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 68,
      "foldCount": 29,
      "sheetW": 364.29999999999995,
      "sheetH": 284.3,
      "geomRel": "mailer-geom/361011.json",
      "geomPublicRel": "mailer-geom/361011.json",
      "coverRel": "mailer-covers/361011.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-10301201",
      "sourceNum": "10301201",
      "label": "Tuck end mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 149.4,
      "width": 99.4,
      "height": 39.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "tuck-end-straight",
      "hasGeometry": true,
      "cutCount": 83,
      "foldCount": 15,
      "sheetW": 515.5,
      "sheetH": 231.85,
      "geomRel": "mailer-geom/10301201.json",
      "geomPublicRel": "mailer-geom/10301201.json",
      "coverRel": "mailer-covers/10301201.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-11205001",
      "sourceNum": "11205001",
      "label": "FEFCO 0216 regular slotted container with snap lock bottom",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 248,
      "width": 148,
      "height": 116.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0201",
      "hasGeometry": true,
      "cutCount": 52,
      "foldCount": 12,
      "sheetW": 834,
      "sheetH": 300.5,
      "geomRel": "mailer-geom/11205001.json",
      "geomPublicRel": "mailer-geom/11205001.json",
      "coverRel": "mailer-covers/11205001.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-15001002",
      "sourceNum": "15001002",
      "label": "Sweet box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 300,
      "width": 200,
      "height": 78,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 122,
      "foldCount": 22,
      "sheetW": 648,
      "sheetH": 644,
      "geomRel": "mailer-geom/15001002.json",
      "geomPublicRel": "mailer-geom/15001002.json",
      "coverRel": "mailer-covers/15001002.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15001003",
      "sourceNum": "15001003",
      "label": "Flip top medicine box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 196.64,
      "width": 149.5,
      "height": 49.5,
      "thickness": 0.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 102,
      "foldCount": 20,
      "sheetW": 403,
      "sheetH": 449.92999,
      "geomRel": "mailer-geom/15001003.json",
      "geomPublicRel": "mailer-geom/15001003.json",
      "coverRel": "mailer-covers/15001003.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15001006",
      "sourceNum": "15001006",
      "label": "Cosmetics box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 265,
      "width": 258,
      "height": 60,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 89,
      "foldCount": 22,
      "sheetW": 541,
      "sheetH": 706,
      "geomRel": "mailer-geom/15001006.json",
      "geomPublicRel": "mailer-geom/15001006.json",
      "coverRel": "mailer-covers/15001006.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15001007",
      "sourceNum": "15001007",
      "label": "Beauty box mockup (mailer box)",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 311.66,
      "width": 201.5,
      "height": 61.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "mailer-parametric-demo",
      "hasGeometry": true,
      "cutCount": 105,
      "foldCount": 20,
      "sheetW": 566,
      "sheetH": 589.92,
      "geomRel": "mailer-geom/15001007.json",
      "geomPublicRel": "mailer-geom/15001007.json",
      "coverRel": "mailer-covers/15001007.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-15001008",
      "sourceNum": "15001008",
      "label": "Personal care box mockup（Mailer box)",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 311.66,
      "width": 201.5,
      "height": 61.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "mailer-parametric-demo",
      "hasGeometry": true,
      "cutCount": 105,
      "foldCount": 20,
      "sheetW": 566,
      "sheetH": 589.92,
      "geomRel": "mailer-geom/15001008.json",
      "geomPublicRel": "mailer-geom/15001008.json",
      "coverRel": "mailer-covers/15001008.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-15001009",
      "sourceNum": "15001009",
      "label": "Supplement box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 311.66,
      "width": 201.5,
      "height": 61.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "mailer-parametric-demo",
      "hasGeometry": true,
      "cutCount": 105,
      "foldCount": 20,
      "sheetW": 566,
      "sheetH": 589.92,
      "geomRel": "mailer-geom/15001009.json",
      "geomPublicRel": "mailer-geom/15001009.json",
      "coverRel": "mailer-covers/15001009.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ]
    },
    {
      "id": "import-mailer-15001103",
      "sourceNum": "15001103",
      "label": "Flip top gift box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 289,
      "width": 302,
      "height": 99,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 87,
      "foldCount": 22,
      "sheetW": 911,
      "sheetH": 721,
      "geomRel": "mailer-geom/15001103.json",
      "geomPublicRel": "mailer-geom/15001103.json",
      "coverRel": "mailer-covers/15001103.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15001106",
      "sourceNum": "15001106",
      "label": "Board game box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 256.2,
      "width": 179.3,
      "height": 59.3,
      "thickness": 0.55,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 103,
      "foldCount": 20,
      "sheetW": 540.05,
      "sheetH": 502.5,
      "geomRel": "mailer-geom/15001106.json",
      "geomPublicRel": "mailer-geom/15001106.json",
      "coverRel": "mailer-covers/15001106.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15201001",
      "sourceNum": "15201001",
      "label": "Sweet box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 147.4,
      "width": 99.4,
      "height": 39.4,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 12,
      "sheetW": 261,
      "sheetH": 304,
      "geomRel": "mailer-geom/15201001.json",
      "geomPublicRel": "mailer-geom/15201001.json",
      "coverRel": "mailer-covers/15201001.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15202101",
      "sourceNum": "15202101",
      "label": "Sweet box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 148.4,
      "width": 149.4,
      "height": 49.4,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 76,
      "foldCount": 12,
      "sheetW": 282,
      "sheetH": 424.5,
      "geomRel": "mailer-geom/15202101.json",
      "geomPublicRel": "mailer-geom/15202101.json",
      "coverRel": "mailer-covers/15202101.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    },
    {
      "id": "import-mailer-15621606",
      "sourceNum": "15621606",
      "label": "Tuck top mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 106,
      "width": 176,
      "height": 43,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 81,
      "foldCount": 21,
      "sheetW": 268,
      "sheetH": 399.5,
      "geomRel": "mailer-geom/15621606.json",
      "geomPublicRel": "mailer-geom/15621606.json",
      "coverRel": "mailer-covers/15621606.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-mailer-15826001",
      "sourceNum": "15826001",
      "label": "Roll end tuck front mailer box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 298,
      "width": 192,
      "height": 96.5,
      "thickness": 1.5,
      "materialId": "kraft",
      "templateId": null,
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 16,
      "sheetW": 647,
      "sheetH": 725,
      "geomRel": "mailer-geom/15826001.json",
      "geomPublicRel": "mailer-geom/15826001.json",
      "coverRel": "mailer-covers/15826001.png",
      "subclassIds": [
        "mailer",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "插口盒"
      ]
    },
    {
      "id": "import-shipping-20001001",
      "sourceNum": "20001001",
      "label": "方形运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 301,
      "width": 301,
      "height": 297,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1264,
      "sheetH": 612,
      "geomRel": "shipping-geom/20001001.json",
      "geomPublicRel": "shipping-geom/20001001.json",
      "coverRel": "shipping-covers/20001001.png",
      "subclassIds": [
        "shipping",
        "square"
      ],
      "subclassLabels": [
        "运输箱",
        "方形盒"
      ],
      "structureCode": "Carton"
    },
    {
      "id": "import-shipping-20001002",
      "sourceNum": "20001002",
      "label": "药盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "shipping-geom/20001002.json",
      "geomPublicRel": "shipping-geom/20001002.json",
      "coverRel": "shipping-covers/20001002.png",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton"
    },
    {
      "id": "import-mailer-36101112",
      "sourceNum": "36101112",
      "label": "Flip top stationery gift box",
      "categoryId": "mailer",
      "categoryLabel": "邮寄盒",
      "length": 180,
      "width": 100,
      "height": 40,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "fefco-0427",
      "hasGeometry": true,
      "cutCount": 68,
      "foldCount": 29,
      "sheetW": 364.29999999999995,
      "sheetH": 284.3,
      "geomRel": "mailer-geom/36101112.json",
      "geomPublicRel": "mailer-geom/36101112.json",
      "coverRel": "mailer-covers/36101112.png",
      "subclassIds": [
        "mailer"
      ],
      "subclassLabels": [
        "邮寄盒"
      ],
      "templateSource": "subclass-correction"
    }
  ],
  "officialSubclasses": [
    {
      "id": "shipping",
      "label": "运输箱",
      "nameKey": "mailing-shipping-boxes",
      "count": 47
    },
    {
      "id": "mailer",
      "label": "邮寄盒",
      "nameKey": "mailer-box",
      "count": 82
    },
    {
      "id": "tuck",
      "label": "插口盒",
      "nameKey": "tuck-end-boxes",
      "count": 23
    },
    {
      "id": "folding",
      "label": "折叠盒",
      "nameKey": "folding-boxes",
      "count": 3
    },
    {
      "id": "handle",
      "label": "带手柄的盒子",
      "nameKey": "boxes-with-handle",
      "count": 9
    },
    {
      "id": "lid",
      "label": "带盖盒",
      "nameKey": "boxes-with-lid",
      "count": 5
    },
    {
      "id": "square",
      "label": "方形盒",
      "nameKey": "square-boxes",
      "count": 2
    }
  ],
  "subclassNote": "Shipping+mailer official subclasses; a preset may belong to multiple."
}
