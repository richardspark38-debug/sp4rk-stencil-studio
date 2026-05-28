import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const PAGE_LAYOUTS = {
  1: { rows: 1, cols: 1, label: "1 Page" },
  4: { rows: 2, cols: 2, label: "4 Pages" },
  6: { rows: 2, cols: 3, label: "6 Pages" },
  9: { rows: 3, cols: 3, label: "9 Pages" },
};

const PAGE_SIZES = {
  letter: { label: "Letter", width: 8.5, height: 11 },
  a4: { label: "A4", width: 8.27, height: 11.69 },
  tabloid: { label: "11 x 17", width: 11, height: 17 },
};

const LAYER_PRESETS = [
  { id: 1, name: "Main Cutout", tone: "#f2f2f2", enabled: true },
  { id: 2, name: "Shadows", tone: "#ff6d2a", enabled: false },
  { id: 3, name: "Highlights", tone: "#f8c36b", enabled: false },
  { id: 4, name: "Eyes / Mouth", tone: "#e63223", enabled: false },
  { id: 5, name: "Detail Color", tone: "#a8a8a8", enabled: false },
  { id: 6, name: "Extra Mask", tone: "#ffffff", enabled: false },
];

const ORDER_PACKAGES = [
  {
    id: "digital",
    name: "Digital Stencil File",
    price: 12,
    detail: "Clean PNG stencil preview for cutting or printing",
    bestFor: "Small stencils, quick previews, hand cutting, and simple black-and-white designs.",
    delivery: "1 cleaned digital stencil image sent by email after review.",
    notIncluded: "No multi-page tiling, SVG tracing, or heavy manual redraw.",
    bullets: ["Black and white cutout file", "Bridge tab notes", "Email delivery after review"],
  },
  {
    id: "tile",
    name: "Tiled Print Pack",
    price: 24,
    detail: "Large stencil split across printable pages",
    bestFor: "Large wall, shop, garage, panel, and oversized stencil jobs.",
    delivery: "Printable page set with page labels and assembly direction.",
    notIncluded: "No machine-ready SVG unless upgraded to custom cleanup.",
    bullets: ["4, 6, or 9 page layouts", "Page labels for assembly", "Good for oversized wall or garage work"],
  },
  {
    id: "custom",
    name: "Custom Cut-Ready Job",
    price: 45,
    detail: "Manual cleanup for vinyl, Cricut, or wrap work",
    bestFor: "Customer work, vinyl cutting, Cricut prep, stickers, wraps, and detailed images.",
    delivery: "Cleaned stencil art prepared around your cutting or paint method.",
    notIncluded: "Rush work, extra color layers, and complex redraws may need a custom quote.",
    bullets: ["Cleaner edges and simplified detail", "Cut method notes", "Best for customer jobs and machines"],
  },
];

const EMPTY_PAYMENT_LINKS = ORDER_PACKAGES.reduce((links, item) => ({ ...links, [item.id]: "" }), {});
const DEFAULT_PAYMENT_LINKS = {
  ...EMPTY_PAYMENT_LINKS,
  digital: "https://buy.stripe.com/test_14A8wRcsu3S2dO8djQ5AQ00",
};
const PAYMENT_LINK_STORAGE_KEY = "sp4rk-stencil-payment-links";
const CONTACT_EMAIL = "sparksdarkdesigns@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=SP4RK%20Stencil%20Order`;

const DEFAULT_BRIDGE = {
  width: 82,
  height: 18,
  rotation: 0,
};

const MAX_ISLAND_WARNINGS = 24;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const outputUrlsRef = useRef([]);

  const [imageName, setImageName] = useState("");
  const [imageReady, setImageReady] = useState(false);
  const [threshold, setThreshold] = useState(128);
  const [contrast, setContrast] = useState(18);
  const [brightness, setBrightness] = useState(0);
  const [invert, setInvert] = useState(false);
  const [bridgeMode, setBridgeMode] = useState(false);
  const [showIslandWarnings, setShowIslandWarnings] = useState(true);
  const [moveMode, setMoveMode] = useState(false);
  const [bridges, setBridges] = useState([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState(null);
  const [bridgeDefaults, setBridgeDefaults] = useState(DEFAULT_BRIDGE);
  const [pageCount, setPageCount] = useState(1);
  const [pageSize, setPageSize] = useState("letter");
  const [layers, setLayers] = useState(LAYER_PRESETS);
  const [activeLayerId, setActiveLayerId] = useState(1);
  const [imageTransform, setImageTransform] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 980, height: 620 });
  const [printPages, setPrintPages] = useState([]);
  const [outputPages, setOutputPages] = useState([]);
  const [outputMode, setOutputMode] = useState("");
  const [sheetView, setSheetView] = useState(false);
  const [printScale, setPrintScale] = useState(75);
  const [orderPackage, setOrderPackage] = useState("digital");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [paymentLinks, setPaymentLinks] = useState(DEFAULT_PAYMENT_LINKS);
  const [view, setView] = useState("landing");

  const pageLayout = PAGE_LAYOUTS[pageCount];
  const selectedBridge = bridges.find((bridge) => bridge.id === selectedBridgeId);
  const activeLayer = layers.find((layer) => layer.id === activeLayerId);
  const enabledLayerCount = layers.filter((layer) => layer.enabled).length;
  const selectedPackage = ORDER_PACKAGES.find((item) => item.id === orderPackage) || ORDER_PACKAGES[0];

  const islandWarnings = useMemo(() => {
    const image = imageRef.current;

    if (!imageReady || !image || imageBounds.width <= 0 || imageBounds.height <= 0) {
      return [];
    }

    return detectStencilIslands(image, imageBounds, {
      brightness,
      contrast,
      invert,
      threshold,
    });
  }, [brightness, contrast, imageBounds, imageReady, invert, threshold]);

  const baseImageBounds = useMemo(() => {
    const image = imageRef.current;

    if (!image || !imageReady) {
      return {
        x: 72,
        y: 54,
        width: canvasSize.width - 144,
        height: canvasSize.height - 108,
      };
    }

    const maxWidth = canvasSize.width - 96;
    const maxHeight = canvasSize.height - 92;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);

    return {
      x: Math.round((canvasSize.width - width) / 2),
      y: Math.round((canvasSize.height - height) / 2),
      width,
      height,
    };
  }, [canvasSize.height, canvasSize.width, imageReady]);

  const imageBounds = useMemo(() => {
    const width = Math.round(baseImageBounds.width * imageTransform.zoom);
    const height = Math.round(baseImageBounds.height * imageTransform.zoom);

    return {
      x: Math.round(baseImageBounds.x + (baseImageBounds.width - width) / 2 + imageTransform.offsetX),
      y: Math.round(baseImageBounds.y + (baseImageBounds.height - height) / 2 + imageTransform.offsetY),
      width,
      height,
    };
  }, [baseImageBounds, imageTransform.offsetX, imageTransform.offsetY, imageTransform.zoom]);

  const renderStencil = useCallback(
    (ctx, options = {}) => {
      const {
        drawBackdrop = true,
        drawGrid = true,
        drawBridgeTabs = true,
        drawFrame = true,
        drawIslandWarnings = true,
        bridgeSelectionId = selectedBridgeId,
        bounds = imageBounds,
      } = options;

      const canvas = ctx.canvas;

      if (drawBackdrop) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (!imageReady || !imageRef.current) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 14]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.56)";
        ctx.font = "700 22px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Upload a stencil source image", canvas.width / 2, canvas.height / 2 - 8);
        ctx.fillStyle = "rgba(255, 109, 42, 0.9)";
        ctx.font = "600 13px Inter, Arial, sans-serif";
        ctx.fillText("JPG, PNG, or WebP", canvas.width / 2, canvas.height / 2 + 24);
        ctx.restore();
        return;
      }

      const image = imageRef.current;
      const workCanvas = document.createElement("canvas");
      const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
      workCanvas.width = Math.max(1, bounds.width);
      workCanvas.height = Math.max(1, bounds.height);
      workCtx.drawImage(image, 0, 0, workCanvas.width, workCanvas.height);

      const imageData = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
      const data = imageData.data;
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let index = 0; index < data.length; index += 4) {
        const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
        const adjusted = clamp(contrastFactor * (gray - 128) + 128 + brightness, 0, 255);
        const cut = invert ? adjusted > threshold : adjusted < threshold;
        const value = cut ? 0 : 255;

        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
      }

      workCtx.putImageData(imageData, 0, 0);

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = drawBackdrop ? 22 : 0;
      ctx.shadowOffsetY = drawBackdrop ? 12 : 0;
      ctx.drawImage(workCanvas, bounds.x, bounds.y);
      ctx.restore();

      if (drawGrid) {
        drawPageGrid(ctx, bounds, pageLayout, PAGE_SIZES[pageSize]);
      }

      if (drawIslandWarnings && showIslandWarnings) {
        drawIslandWarningsOverlay(ctx, islandWarnings);
      }

      if (drawBridgeTabs) {
        drawBridges(ctx, bridges, bridgeSelectionId);
      }

      if (drawFrame) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 109, 42, 0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2);
        ctx.restore();
      }
    },
    [
      brightness,
      bridges,
      contrast,
      imageBounds,
      imageReady,
      islandWarnings,
      invert,
      pageLayout,
      pageSize,
      selectedBridgeId,
      showIslandWarnings,
      threshold,
    ]
  );

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !ctx) {
      return;
    }

    renderStencil(ctx);
  }, [renderStencil]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth < 900 ? window.innerWidth - 36 : 980;
      const height = window.innerWidth < 900 ? 520 : 620;
      setCanvasSize({ width: Math.max(width, 320), height });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!selectedBridgeId) {
      return;
    }

    const stillExists = bridges.some((bridge) => bridge.id === selectedBridgeId);
    if (!stillExists) {
      setSelectedBridgeId(null);
    }
  }, [bridges, selectedBridgeId]);

  useEffect(() => {
    return () => {
      outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      outputUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PAYMENT_LINK_STORAGE_KEY) || "{}");
      setPaymentLinks({ ...DEFAULT_PAYMENT_LINKS, ...saved });
    } catch {
      setPaymentLinks(DEFAULT_PAYMENT_LINKS);
    }
  }, []);

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const findBridgeAtPoint = (point) => {
    for (let index = bridges.length - 1; index >= 0; index -= 1) {
      const bridge = bridges[index];
      const dx = point.x - bridge.x;
      const dy = point.y - bridge.y;
      const radians = (-bridge.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
      const localY = dx * Math.sin(radians) + dy * Math.cos(radians);

      if (Math.abs(localX) <= bridge.width / 2 && Math.abs(localY) <= bridge.height / 2) {
        return bridge;
      }
    }

    return null;
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      window.alert("Please upload a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        imageRef.current = image;
        setImageName(file.name);
        setImageReady(true);
        setImageTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
        setBridges([]);
        setSelectedBridgeId(null);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (event) => {
    if (!imageReady) {
      return;
    }

    const point = getCanvasPoint(event);
    const bridge = findBridgeAtPoint(point);

    if (bridge) {
      setSelectedBridgeId(bridge.id);
      dragRef.current = {
        type: "bridge",
        id: bridge.id,
        offsetX: point.x - bridge.x,
        offsetY: point.y - bridge.y,
      };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }

    const insideImage =
      point.x >= imageBounds.x &&
      point.x <= imageBounds.x + imageBounds.width &&
      point.y >= imageBounds.y &&
      point.y <= imageBounds.y + imageBounds.height;

    if (moveMode && insideImage) {
      setSelectedBridgeId(null);
      dragRef.current = {
        type: "image",
        startX: point.x,
        startY: point.y,
        offsetX: imageTransform.offsetX,
        offsetY: imageTransform.offsetY,
      };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }

    if (!bridgeMode) {
      setSelectedBridgeId(null);
      return;
    }

    if (!insideImage) {
      setSelectedBridgeId(null);
      return;
    }

    const newBridge = {
      id: createId(),
      x: point.x,
      y: point.y,
      width: bridgeDefaults.width,
      height: bridgeDefaults.height,
      rotation: bridgeDefaults.rotation,
    };

    setBridges((current) => [...current, newBridge]);
    setSelectedBridgeId(newBridge.id);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const point = getCanvasPoint(event);

    if (drag.type === "image") {
      setImageTransform((current) => ({
        ...current,
        offsetX: drag.offsetX + point.x - drag.startX,
        offsetY: drag.offsetY + point.y - drag.startY,
      }));
      return;
    }

    setBridges((current) =>
      current.map((bridge) =>
        bridge.id === drag.id
          ? {
              ...bridge,
              x: clamp(point.x - drag.offsetX, imageBounds.x, imageBounds.x + imageBounds.width),
              y: clamp(point.y - drag.offsetY, imageBounds.y, imageBounds.y + imageBounds.height),
            }
          : bridge
      )
    );
  };

  const handlePointerUp = (event) => {
    dragRef.current = null;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const resetImagePlacement = () => {
    setImageTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const nudgeImage = (x, y) => {
    setImageTransform((current) => ({
      ...current,
      offsetX: current.offsetX + x,
      offsetY: current.offsetY + y,
    }));
  };

  const updateSelectedBridge = (updates) => {
    if (!selectedBridgeId) {
      setBridgeDefaults((current) => ({ ...current, ...updates }));
      return;
    }

    setBridges((current) =>
      current.map((bridge) => (bridge.id === selectedBridgeId ? { ...bridge, ...updates } : bridge))
    );
  };

  const rotateSelectedBridge = (amount) => {
    if (!selectedBridgeId) {
      setBridgeDefaults((current) => ({ ...current, rotation: (current.rotation + amount + 360) % 360 }));
      return;
    }

    setBridges((current) =>
      current.map((bridge) =>
        bridge.id === selectedBridgeId
          ? { ...bridge, rotation: (bridge.rotation + amount + 360) % 360 }
          : bridge
      )
    );
  };

  const duplicateSelectedBridge = () => {
    if (!selectedBridge) {
      return;
    }

    const copy = {
      ...selectedBridge,
      id: createId(),
      x: clamp(selectedBridge.x + 24, imageBounds.x, imageBounds.x + imageBounds.width),
      y: clamp(selectedBridge.y + 24, imageBounds.y, imageBounds.y + imageBounds.height),
    };

    setBridges((current) => [...current, copy]);
    setSelectedBridgeId(copy.id);
  };

  const deleteSelectedBridge = () => {
    if (!selectedBridgeId) {
      return;
    }

    setBridges((current) => current.filter((bridge) => bridge.id !== selectedBridgeId));
    setSelectedBridgeId(null);
  };

  const clearBridges = () => {
    setBridges([]);
    setSelectedBridgeId(null);
  };

  const addBridgeTabsForIslands = () => {
    if (!islandWarnings.length) {
      return;
    }

    const newBridges = islandWarnings.slice(0, 12).map((island) => {
      const bridgeToLeft = island.center.x > imageBounds.x + imageBounds.width / 2;
      const width = clamp(Math.max(70, island.bounds.width * 0.9), 58, 150);

      return {
        id: createId(),
        x: bridgeToLeft ? island.bounds.x + island.bounds.width * 0.12 : island.bounds.x + island.bounds.width * 0.88,
        y: island.center.y,
        width,
        height: clamp(Math.max(14, island.bounds.height * 0.16), 12, 26),
        rotation: 0,
      };
    });

    setBridges((current) => [...current, ...newBridges]);
    setSelectedBridgeId(newBridges[0]?.id || null);
    setBridgeMode(true);
    setShowIslandWarnings(true);
  };

  const toggleLayer = (layerId) => {
    setLayers((current) =>
      current.map((layer) => (layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer))
    );
    setActiveLayerId(layerId);
  };

  const clearObjectUrls = () => {
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    outputUrlsRef.current = [];
  };

  const createOutputPage = (canvas, label, fileName) => {
    const dataUrl = canvas.toDataURL("image/png");
    const blob = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    outputUrlsRef.current.push(objectUrl);

    return {
      label,
      fileName,
      dataUrl,
      objectUrl,
    };
  };

  const setPreparedOutput = (mode, pages) => {
    setOutputMode(mode);
    setOutputPages(pages);
    setPrintPages(pages);
  };

  const createCleanSourceCanvas = () => {
    const sourceCanvas = canvasRef.current;

    if (!sourceCanvas || !imageReady) {
      return null;
    }

    const cleanCanvas = document.createElement("canvas");
    const cleanCtx = cleanCanvas.getContext("2d");
    cleanCanvas.width = sourceCanvas.width;
    cleanCanvas.height = sourceCanvas.height;
    renderStencil(cleanCtx, {
      drawGrid: false,
      drawBridgeTabs: true,
      drawFrame: true,
      drawIslandWarnings: false,
      bridgeSelectionId: null,
    });

    return cleanCanvas;
  };

  const createCleanPreviewPage = () => {
    const cleanCanvas = createCleanSourceCanvas();

    if (!cleanCanvas) {
      return null;
    }

    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d");
    pageCanvas.width = imageBounds.width;
    pageCanvas.height = imageBounds.height;
    pageCtx.fillStyle = "#ffffff";
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.drawImage(
      cleanCanvas,
      imageBounds.x,
      imageBounds.y,
      imageBounds.width,
      imageBounds.height,
      0,
      0,
      pageCanvas.width,
      pageCanvas.height
    );

    return pageCanvas;
  };

  const exportPng = () => {
    const pageCanvas = createCleanPreviewPage();

    if (!pageCanvas || !imageReady) {
      return;
    }

    clearObjectUrls();
    const baseName = imageName.replace(/\.[^/.]+$/, "") || "sp4rk-stencil";
    setPreparedOutput("Export Preview", [
      createOutputPage(pageCanvas, "SP4RK Stencil Studio | Full Preview", `${baseName}-preview.png`),
    ]);
  };

  const createTiledPageImages = () => {
    const sourceCanvas = createCleanSourceCanvas();

    if (!sourceCanvas || !imageReady) {
      return [];
    }

    const cellWidth = imageBounds.width / pageLayout.cols;
    const cellHeight = imageBounds.height / pageLayout.rows;
    const pages = [];

    for (let row = 0; row < pageLayout.rows; row += 1) {
      for (let col = 0; col < pageLayout.cols; col += 1) {
        const pageNumber = row * pageLayout.cols + col + 1;
        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d");
        pageCanvas.width = Math.round(cellWidth);
        pageCanvas.height = Math.round(cellHeight);
        pageCtx.fillStyle = "#ffffff";
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          sourceCanvas,
          imageBounds.x + col * cellWidth,
          imageBounds.y + row * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        );

        const label = `SP4RK Stencil Studio | Page ${pageNumber} of ${pageCount}`;
        const fileName = `${baseNameForFile(imageName)}-page-${pageNumber}.png`;
        pages.push({
          pageNumber,
          ...createOutputPage(pageCanvas, label, fileName),
        });
      }
    }

    return pages;
  };

  const exportTiledPages = () => {
    clearObjectUrls();
    const pages = createTiledPageImages();
    setPreparedOutput("Export Pages", pages);
  };

  const printPreparedSheet = () => {
    window.setTimeout(() => {
      window.print();
    }, 450);
  };

  const preparePrint = (pages, mode, shouldPrint = false) => {
    if (!pages.length) {
      return;
    }

    setPreparedOutput(mode, pages);
    setSheetView(true);

    if (shouldPrint) {
      printPreparedSheet();
    }
  };

  const printCurrentPreview = () => {
    const pageCanvas = createCleanPreviewPage();

    if (!pageCanvas || !imageReady) {
      return;
    }

    clearObjectUrls();
    preparePrint(
      [
        {
          ...createOutputPage(
            pageCanvas,
            "SP4RK Stencil Studio | Full Preview",
            `${baseNameForFile(imageName)}-preview.png`
          ),
        },
      ],
      "Print Preview",
      true
    );
  };

  const printTiledPages = () => {
    clearObjectUrls();
    const pages = createTiledPageImages().map((page) => ({
      label: `SP4RK Stencil Studio | Page ${page.pageNumber} of ${pageCount}`,
      fileName: page.fileName,
      dataUrl: page.dataUrl,
      objectUrl: page.objectUrl,
    }));

    preparePrint(pages, "Print Pages", true);
  };

  const clearOutput = () => {
    clearObjectUrls();
    setOutputPages([]);
    setPrintPages([]);
    setOutputMode("");
    setSheetView(false);
  };

  const prepareOrder = () => {
    const activePaymentLink = paymentLinks[orderPackage]?.trim();

    if (!activePaymentLink) {
      setOrderMessage(`Payment link missing for ${selectedPackage.name}. Paste the Stripe link for this package first.`);
      return;
    }

    const summary = [
      `SP4RK order ready: ${selectedPackage.name}`,
      `Price: $${selectedPackage.price}`,
      `Customer: ${customerEmail || "add customer email"}`,
      imageReady ? `Pages: ${pageCount} page layout, ${PAGE_SIZES[pageSize].label}` : "Stencil image: customer will send/upload after payment",
      `Bridges: ${bridges.length}`,
      `Layers selected: ${enabledLayerCount}`,
      `Notes: ${orderNotes || "none"}`,
      `Opening payment link: ${activePaymentLink}`,
    ].join("\n");

    setOrderMessage(summary);
    window.location.href = activePaymentLink;
  };

  const savePaymentLink = (packageId, value) => {
    const nextLinks = { ...paymentLinks, [packageId]: value };
    setPaymentLinks(nextLinks);
    localStorage.setItem(PAYMENT_LINK_STORAGE_KEY, JSON.stringify(nextLinks));
  };

  const activeBridgeSettings = selectedBridge || bridgeDefaults;

  if (view === "landing") {
    return <LandingPage onOpenStudio={() => setView("studio")} />;
  }

  return (
    <>
      <main className={sheetView ? "app-shell sheet-mode" : "app-shell"}>
        <aside className="side-panel">
        <div className="brand-lockup">
          <span className="brand-mark">SP4RK</span>
          <div>
            <h1>Stencil Studio</h1>
            <p>Sparks Dark Designs cutout lab</p>
          </div>
        </div>

        <button className="wide-action" type="button" onClick={() => setView("landing")}>
          Back to Website
        </button>

        <section className="panel-section">
          <div className="section-heading">
            <span>01</span>
            <h2>Source</h2>
          </div>
          <button className="primary-action" type="button" onClick={() => fileInputRef.current?.click()}>
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
          />
          <p className="file-name">{imageName || "JPG, PNG, or WebP source file"}</p>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>02</span>
            <h2>Image Fit</h2>
          </div>

          <label className="range-control">
            <span>Zoom</span>
            <strong>{imageTransform.zoom.toFixed(2)}x</strong>
            <input
              type="range"
              min="0.35"
              max="2.5"
              step="0.01"
              value={imageTransform.zoom}
              onChange={(event) =>
                setImageTransform((current) => ({ ...current, zoom: Number(event.target.value) }))
              }
            />
          </label>

          <label className="toggle-row">
            <input type="checkbox" checked={moveMode} onChange={(event) => setMoveMode(event.target.checked)} />
            <span>Drag image placement</span>
          </label>

          <div className="nudge-pad" aria-label="Image nudge controls">
            <span />
            <button type="button" onClick={() => nudgeImage(0, -12)} disabled={!imageReady}>
              Up
            </button>
            <span />
            <button type="button" onClick={() => nudgeImage(-12, 0)} disabled={!imageReady}>
              Left
            </button>
            <button type="button" onClick={resetImagePlacement} disabled={!imageReady}>
              Reset
            </button>
            <button type="button" onClick={() => nudgeImage(12, 0)} disabled={!imageReady}>
              Right
            </button>
            <span />
            <button type="button" onClick={() => nudgeImage(0, 12)} disabled={!imageReady}>
              Down
            </button>
            <span />
          </div>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>03</span>
            <h2>Stencil Cut</h2>
          </div>

          <label className="range-control">
            <span>Threshold</span>
            <strong>{threshold}</strong>
            <input
              type="range"
              min="0"
              max="255"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
          </label>

          <label className="range-control">
            <span>Contrast</span>
            <strong>{contrast}</strong>
            <input
              type="range"
              min="-120"
              max="120"
              value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))}
            />
          </label>

          <label className="range-control">
            <span>Brightness</span>
            <strong>{brightness}</strong>
            <input
              type="range"
              min="-100"
              max="100"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
            />
          </label>

          <label className="toggle-row">
            <input type="checkbox" checked={invert} onChange={(event) => setInvert(event.target.checked)} />
            <span>Invert black / white</span>
          </label>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>04</span>
            <h2>Bridge Tabs</h2>
          </div>
          <label className="toggle-row bridge-toggle">
            <input
              type="checkbox"
              checked={bridgeMode}
              onChange={(event) => setBridgeMode(event.target.checked)}
            />
            <span>Click canvas to add tabs</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showIslandWarnings}
              onChange={(event) => setShowIslandWarnings(event.target.checked)}
            />
            <span>Show island warnings</span>
          </label>

          <div className="island-warning-panel">
            <strong>{islandWarnings.length}</strong>
            <span>possible white island{islandWarnings.length === 1 ? "" : "s"} found</span>
          </div>
          <button
            className="wide-action"
            type="button"
            onClick={addBridgeTabsForIslands}
            disabled={!islandWarnings.length}
          >
            Auto Add Bridge Tabs
          </button>

          <label className="range-control">
            <span>Tab Width</span>
            <strong>{Math.round(activeBridgeSettings.width)}px</strong>
            <input
              type="range"
              min="28"
              max="180"
              value={activeBridgeSettings.width}
              onChange={(event) => updateSelectedBridge({ width: Number(event.target.value) })}
            />
          </label>

          <label className="range-control">
            <span>Tab Height</span>
            <strong>{Math.round(activeBridgeSettings.height)}px</strong>
            <input
              type="range"
              min="8"
              max="54"
              value={activeBridgeSettings.height}
              onChange={(event) => updateSelectedBridge({ height: Number(event.target.value) })}
            />
          </label>

          <div className="button-row">
            <button type="button" onClick={() => rotateSelectedBridge(-15)}>
              Rotate -15
            </button>
            <button type="button" onClick={() => rotateSelectedBridge(15)}>
              Rotate +15
            </button>
          </div>
          <div className="button-row">
            <button type="button" onClick={duplicateSelectedBridge} disabled={!selectedBridge}>
              Duplicate
            </button>
            <button type="button" onClick={deleteSelectedBridge} disabled={!selectedBridge}>
              Delete
            </button>
          </div>
          <button className="wide-action" type="button" onClick={clearBridges} disabled={!bridges.length}>
            Clear All Tabs
          </button>
          <p className="micro-copy">
            {bridges.length} bridge tab{bridges.length === 1 ? "" : "s"} placed
            {selectedBridge ? " | selected tab is editable" : " | sliders set the next tab"}
          </p>
        </section>
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Cutout Preview</p>
            <h2>Black and white printable stencil</h2>
          </div>
          <div className="export-actions">
            <button className="export-button secondary" type="button" onClick={printTiledPages} disabled={!imageReady}>
              Print Sheet
            </button>
            <button className="export-button secondary" type="button" onClick={printCurrentPreview} disabled={!imageReady}>
              Print Preview
            </button>
            <button className="export-button secondary" type="button" onClick={exportTiledPages} disabled={!imageReady}>
              Page PNGs
            </button>
            <button className="export-button" type="button" onClick={exportPng} disabled={!imageReady}>
              PNG Preview
            </button>
          </div>
        </header>

        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={[bridgeMode ? "bridge-cursor" : "", moveMode ? "move-cursor" : ""].join(" ")}
            aria-label="Stencil preview canvas"
          />
        </div>

        <footer className="studio-footer">
          <section className="legend-panel" aria-label="Cut guide legend">
            <div className="legend-item">
              <span className="swatch cut" />
              <p>
                <strong>BLACK</strong>
                Cut out
              </p>
            </div>
            <div className="legend-item">
              <span className="swatch keep" />
              <p>
                <strong>WHITE</strong>
                Keep
              </p>
            </div>
            <div className="legend-item">
              <span className="swatch bridge" />
              <p>
                <strong>RED / GRAY TABS</strong>
                Do not cut / bridge
              </p>
            </div>
          </section>

          <section className="page-panel" aria-label="Page grid options">
            <div>
              <p className="eyebrow">Print Split</p>
              <h3>
                {PAGE_SIZES[pageSize].label} / {pageLayout.rows} x {pageLayout.cols}
              </h3>
            </div>
            <div className="page-tools">
              <div className="page-options">
                {Object.entries(PAGE_LAYOUTS).map(([count, layout]) => (
                  <button
                    key={count}
                    type="button"
                    className={pageCount === Number(count) ? "active" : ""}
                    onClick={() => setPageCount(Number(count))}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
              <div className="page-options size-options">
                {Object.entries(PAGE_SIZES).map(([key, size]) => (
                  <button
                    key={key}
                    type="button"
                    className={pageSize === key ? "active" : ""}
                    onClick={() => setPageSize(key)}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="layer-panel" aria-label="Layer studio">
            <div>
              <p className="eyebrow">Layer Studio</p>
              <h3>{enabledLayerCount} active stencil layer{enabledLayerCount === 1 ? "" : "s"}</h3>
            </div>
            <div className="layer-list">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={[
                    "layer-chip",
                    layer.enabled ? "enabled" : "",
                    activeLayerId === layer.id ? "active" : "",
                  ].join(" ")}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <span className="layer-dot" style={{ backgroundColor: layer.tone }} />
                  <span>L{layer.id}</span>
                  <strong>{layer.name}</strong>
                </button>
              ))}
            </div>
            <p className="micro-copy">
              Active setup: {activeLayer?.name}. Multi-layer tracing is staged for the next engine pass.
            </p>
          </section>

          <section className="print-save-panel" aria-label="Print and save controls">
            <div>
              <p className="eyebrow">Print / Save</p>
              <h3>Clean sheet output</h3>
            </div>
            <label className="range-control print-size-control">
              <span>Print Size</span>
              <strong>{printScale}%</strong>
              <input
                type="range"
                min="25"
                max="125"
                step="5"
                value={printScale}
                onChange={(event) => setPrintScale(Number(event.target.value))}
              />
            </label>
            <div className="button-row">
              <button type="button" onClick={() => setPrintScale(50)}>
                Small
              </button>
              <button type="button" onClick={() => setPrintScale(75)}>
                Medium
              </button>
              <button type="button" onClick={() => setPrintScale(100)}>
                Full Page
              </button>
              <button type="button" onClick={() => setPrintScale(125)}>
                Larger
              </button>
            </div>
            <div className="print-save-grid">
              <button type="button" onClick={printTiledPages} disabled={!imageReady}>
                Print Tiled Sheet
              </button>
              <button type="button" onClick={printCurrentPreview} disabled={!imageReady}>
                Print Full Sheet
              </button>
            </div>
            <p className="micro-copy">
              Lower Print Size if it comes out too big. These open the printable sheet and trigger your browser print
              window.
            </p>
          </section>

          <section className="checkout-panel" aria-label="Customer checkout">
            <div>
              <p className="eyebrow">Customer Checkout</p>
              <h3>Stencil order / payment</h3>
            </div>
            <div className="package-grid">
              {ORDER_PACKAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={orderPackage === item.id ? "package-card active" : "package-card"}
                  onClick={() => setOrderPackage(item.id)}
                >
                  <span>{item.name}</span>
                  <strong>${item.price}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
            <label className="text-control">
              <span>{selectedPackage.name} Payment Link</span>
              <input
                type="url"
                value={paymentLinks[orderPackage] || ""}
                placeholder="https://buy.stripe.com/... or PayPal payment link"
                onChange={(event) => savePaymentLink(orderPackage, event.target.value)}
              />
            </label>
            <label className="text-control">
              <span>Customer Email</span>
              <input
                type="email"
                value={customerEmail}
                placeholder="customer@email.com"
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </label>
            <label className="text-control">
              <span>Order Notes</span>
              <textarea
                value={orderNotes}
                placeholder="Cut size, material, deadline, colors, shipping notes"
                onChange={(event) => setOrderNotes(event.target.value)}
              />
            </label>
            <button className="pay-action" type="button" onClick={prepareOrder}>
              Start Payment
            </button>
            {orderMessage && <pre className="order-summary">{orderMessage}</pre>}
            <p className="micro-copy">
              Create Stripe Payment Links for each package, paste them here once, then this button sends customers to pay.
            </p>
          </section>

          {outputPages.length > 0 && (
            <section className="output-panel" aria-label="Prepared output">
              <div className="output-heading">
                <div>
                  <p className="eyebrow">{outputMode}</p>
                  <h3>{outputPages.length} prepared file{outputPages.length === 1 ? "" : "s"}</h3>
                </div>
                <div className="output-actions">
                  <button type="button" onClick={() => setSheetView(true)}>
                    Sheet View
                  </button>
                  <button type="button" onClick={clearOutput}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="output-grid">
                {outputPages.map((page) => (
                  <article className="output-card" key={page.label}>
                    <img src={page.objectUrl || page.dataUrl} alt={page.label} />
                    <div>
                      <strong>{page.label}</strong>
                    </div>
                  </article>
                ))}
              </div>
              <p className="micro-copy">
                Right-click an image to save it, or use Sheet View and print from the browser menu.
              </p>
            </section>
          )}
        </footer>
      </section>
      </main>

      {sheetView && (
        <section
          className="sheet-stage"
          aria-label="Printable stencil sheet"
          style={{ "--print-scale": `${printScale}%` }}
        >
          <header className="sheet-toolbar">
            <div>
              <p className="eyebrow">{outputMode}</p>
              <h2>Prepared stencil sheet</h2>
              <span>
                Print size: {printScale}%. Click Print Now. If the print window is blocked, press Ctrl+P on this sheet.
              </span>
            </div>
            <div className="sheet-toolbar-actions">
              <button type="button" onClick={printPreparedSheet}>
                Print Now
              </button>
              <button type="button" onClick={() => setSheetView(false)}>
                Back to Studio
              </button>
            </div>
          </header>
          <div className="sheet-pages">
            {outputPages.map((page) => (
              <article className="sheet-page" key={page.label}>
                <img src={page.objectUrl || page.dataUrl} alt={page.label} />
                <footer>{page.label}</footer>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="print-stage" aria-hidden={!printPages.length}>
        {printPages.map((page) => (
          <article className="print-page" key={page.label}>
            <img src={page.objectUrl || page.dataUrl} alt={page.label} />
            <footer>{page.label}</footer>
          </article>
        ))}
      </section>
    </>
  );
}

function LandingPage({ onOpenStudio }) {
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="SP4RK website navigation">
        <div className="brand-lockup compact">
          <span className="brand-mark">SP4RK</span>
          <div>
            <h1>Stencil Studio</h1>
            <p>Sparks Dark Designs</p>
          </div>
        </div>
        <div className="nav-actions">
          <a href="#work">Work</a>
          <a href="#pricing">Pricing</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
          <button type="button" onClick={onOpenStudio}>
            Launch Studio
          </button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Printable stencil files for cutters, paint, wraps, and airbrush work</p>
          <h2>Custom stencil artwork built from your photo.</h2>
          <p>
            Upload your image, preview the black-and-white cutout, then order a cleaned file for hand cutting, vinyl,
            Cricut, airbrushing, sticker work, or wrap layouts.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={onOpenStudio}>
              Build A Preview
            </button>
            <a href={DEFAULT_PAYMENT_LINKS.digital}>Order Digital File</a>
          </div>
          <div className="hero-stats" aria-label="SP4RK service highlights">
            <span>Black / white cut files</span>
            <span>Bridge tab planning</span>
            <span>Tiled print pages</span>
          </div>
        </div>

        <div className="hero-preview" aria-label="Stencil artwork preview">
          <div className="preview-paper">
            <div className="paper-label">
              <span>SP4RK Stencil Studio</span>
              <strong>Cut Preview</strong>
            </div>
            <div className="skull-row">
              <span />
              <span />
              <span />
            </div>
            <div className="stencil-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="cut-legend">
              <b>BLACK = CUT</b>
              <b>WHITE = KEEP</b>
              <b>RED = BRIDGE</b>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="SP4RK capabilities">
        <span>Photo to stencil</span>
        <span>Printable page packs</span>
        <span>Cricut / vinyl prep</span>
        <span>Airbrush mask planning</span>
      </section>

      <section className="site-section instructions-section" id="order-steps">
        <div>
          <p className="eyebrow">Order Instructions</p>
          <h2>Four steps from photo to stencil file.</h2>
          <p>
            The studio lets you test the look first. Your order notes tell SP4RK what size, material, and cutting method
            the final file needs to work for.
          </p>
        </div>
        <div className="instruction-grid">
          <article>
            <span>01</span>
            <h3>Upload</h3>
            <p>Open the studio and upload a JPG, PNG, or WebP source image.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Preview</h3>
            <p>Adjust threshold, invert, brightness, contrast, bridge tabs, and page layout.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Pay</h3>
            <p>Choose your package, pay through Stripe, then include your order notes.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Receive</h3>
            <p>SP4RK reviews the artwork and sends the cleaned file or print pack by email.</p>
          </article>
        </div>
      </section>

      <section className="site-section customer-section">
        <div>
          <p className="eyebrow">Built For Real Jobs</p>
          <h2>From one-off garage cuts to customer wrap and sticker prep.</h2>
        </div>
        <div className="customer-grid">
          <article>
            <h3>Hand Cutting</h3>
            <p>Printable black areas, keep areas, and bridge tabs for knife-cut stencil work.</p>
          </article>
          <article>
            <h3>Cricut / Vinyl</h3>
            <p>Cleaner shape direction for machine-cut jobs that need fewer fragile details.</p>
          </article>
          <article>
            <h3>Airbrush</h3>
            <p>Layer planning for shadows, highlights, eyes, mouth, and extra paint passes.</p>
          </article>
          <article>
            <h3>Wrap / Sticker Work</h3>
            <p>Stencil-style artwork cleanup for custom decals, masks, and bold graphic layouts.</p>
          </article>
        </div>
      </section>

      <section className="site-section gallery-section" aria-label="Sample stencil gallery">
        <div className="section-title">
          <p className="eyebrow">Sample Output</p>
          <h2>Dark stencil looks customers can understand fast.</h2>
        </div>
        <div className="sample-grid">
          <article className="sample-card">
            <div className="sample-art sample-face" aria-hidden="true" />
            <h3>Portrait Cutout</h3>
            <p>Bold face shapes, hard shadows, and bridge planning for hand cutting.</p>
          </article>
          <article className="sample-card">
            <div className="sample-art sample-tile" aria-hidden="true" />
            <h3>Tiled Print Pack</h3>
            <p>Large stencil split into labeled pages with alignment marks.</p>
          </article>
          <article className="sample-card">
            <div className="sample-art sample-layer" aria-hidden="true" />
            <h3>Layer Planning</h3>
            <p>Separate passes for shadows, highlights, and painted details.</p>
          </article>
        </div>
      </section>

      <section className="site-section work-section" id="work">
        <div className="section-title">
          <p className="eyebrow">What You Get</p>
          <h2>Cleaner stencil files without guessing.</h2>
        </div>
        <div className="service-grid">
          <article className="service-tile">
            <span>01</span>
            <h3>Cutout Preview</h3>
            <p>See the black cut areas before you order, then tune threshold, brightness, and contrast.</p>
          </article>
          <article className="service-tile">
            <span>02</span>
            <h3>Bridge Tabs</h3>
            <p>Add do-not-cut bridge tabs so inner islands and small details have a better chance of holding.</p>
          </article>
          <article className="service-tile">
            <span>03</span>
            <h3>Print Pages</h3>
            <p>Split oversized artwork into 4, 6, or 9 printable pages for large stencils and garage work.</p>
          </article>
          <article className="service-tile">
            <span>04</span>
            <h3>Custom Cleanup</h3>
            <p>Send notes for vinyl, Cricut, airbrush, sticker, wrap, or hand-cut output.</p>
          </article>
        </div>
      </section>

      <section className="site-section" id="pricing">
        <div className="section-title">
          <p className="eyebrow">Pricing</p>
          <h2>Simple launch packages</h2>
        </div>
        <div className="pricing-grid">
          {ORDER_PACKAGES.map((item) => (
            <article className="price-card" key={item.id}>
              <span>{item.name}</span>
              <strong>${item.price}</strong>
              <p>{item.detail}</p>
              <dl className="package-details">
                <div>
                  <dt>Best For</dt>
                  <dd>{item.bestFor}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{item.delivery}</dd>
                </div>
                <div>
                  <dt>Not Included</dt>
                  <dd>{item.notIncluded}</dd>
                </div>
              </dl>
              <ul>
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {item.id === "digital" ? (
                <a href={DEFAULT_PAYMENT_LINKS.digital}>Order Digital File</a>
              ) : (
                <button type="button" onClick={onOpenStudio}>
                  Build Preview
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="site-section package-guide-section">
        <div className="section-title">
          <p className="eyebrow">Package Guide</p>
          <h2>Pick the package that matches the job.</h2>
        </div>
        <div className="package-guide">
          <article>
            <strong>Choose $12</strong>
            <p>When you need a simple stencil image and can print or cut it yourself.</p>
          </article>
          <article>
            <strong>Choose $24</strong>
            <p>When the stencil needs to be printed bigger than one sheet of paper.</p>
          </article>
          <article>
            <strong>Choose $45</strong>
            <p>When the file needs manual cleanup for cutting machines, wraps, decals, or customer work.</p>
          </article>
        </div>
      </section>

      <section className="site-section split-section" id="process">
        <div>
          <p className="eyebrow">How It Works</p>
          <h2>Upload, preview, order, then receive the cleaned stencil file.</h2>
        </div>
        <ol className="process-list">
          <li><strong>Upload</strong> your source photo or artwork in the studio.</li>
          <li><strong>Preview</strong> threshold, contrast, brightness, page layout, and bridge tabs.</li>
          <li><strong>Order</strong> the package that matches your job and add notes for size, material, and deadline.</li>
          <li><strong>Receive</strong> printable files or cut-ready cleanup by email after review.</li>
        </ol>
      </section>

      <section className="site-section deliverables-section">
        <div className="section-title">
          <p className="eyebrow">Deliverables</p>
          <h2>Clear files, clear expectations.</h2>
        </div>
        <div className="deliverables-grid">
          <div>
            <strong>Included</strong>
            <p>Stencil preview, cut/keep legend, package notes, and printable output based on the package selected.</p>
          </div>
          <div>
            <strong>Best Results</strong>
            <p>Use a sharp photo with strong lighting, visible subject edges, and not too much background clutter.</p>
          </div>
          <div>
            <strong>Next Up</strong>
            <p>SVG, PDF, true inch sizing, and advanced layer packs are planned as the studio grows.</p>
          </div>
        </div>
      </section>

      <section className="site-section policy-section" id="order">
        <div>
          <p className="eyebrow">Before You Order</p>
          <h2>Image quality matters.</h2>
          <p>
            Clean, high-contrast photos make the best stencils. Some designs may need manual cleanup, extra bridge tabs,
            or simplified detail so the stencil can actually be cut and painted.
          </p>
        </div>
        <div>
          <p className="eyebrow">Custom Work Policy</p>
          <h2>Digital work starts after review.</h2>
          <p>
            If a source image cannot be turned into a usable stencil, the order can be cancelled before custom cleanup
            begins. Finished digital stencil files are custom artwork.
          </p>
        </div>
      </section>

      <section className="site-section faq-section">
        <div>
          <p className="eyebrow">Good Source Images</p>
          <h2>Send the cleanest photo you have.</h2>
        </div>
        <div className="faq-grid">
          <article>
            <h3>Best files</h3>
            <p>Sharp JPG, PNG, or WebP images with clear subject edges and strong lighting.</p>
          </article>
          <article>
            <h3>Harder jobs</h3>
            <p>Blurry faces, tiny details, busy backgrounds, and low contrast images may need custom cleanup.</p>
          </article>
          <article>
            <h3>Tell us</h3>
            <p>Include final size, cutting method, paint method, material, and deadline in the order notes.</p>
          </article>
        </div>
      </section>

      <section className="site-section contact-section" id="contact">
        <div>
          <p className="eyebrow">Contact</p>
          <h2>Send the image, size, material, and deadline.</h2>
          <p>
            Use email for custom questions, source images, order notes, wrap/sticker ideas, and anything that needs a
            quick review before payment.
          </p>
        </div>
        <div className="contact-card">
          <span>SP4RK / Sparks Dark Designs</span>
          <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
          <p>Include the final stencil size, cutting method, material, and when you need it.</p>
          <div className="contact-actions">
            <a href={CONTACT_MAILTO}>Email SP4RK</a>
            <button type="button" onClick={onOpenStudio}>
              Build Preview
            </button>
          </div>
        </div>
      </section>

      <section className="site-section order-band">
        <div>
          <p className="eyebrow">Ready To Build</p>
          <h2>Preview the stencil, then send it through checkout.</h2>
          <p>Start in the studio, tune the look, choose your package, and pay with the Stripe link.</p>
        </div>
        <div className="order-actions">
          <button type="button" onClick={onOpenStudio}>
            Launch Studio
          </button>
          <a href={DEFAULT_PAYMENT_LINKS.digital}>Order Digital File</a>
        </div>
      </section>

      <footer className="site-footer">
        <strong>SP4RK / Sparks Dark Designs</strong>
        <span>Printable stencil previews, page packs, bridge tabs, and cut-ready cleanup.</span>
      </footer>
    </main>
  );
}

function baseNameForFile(name) {
  return name.replace(/\.[^/.]+$/, "") || "sp4rk-stencil";
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function drawPageGrid(ctx, bounds, layout, size) {
  const cellWidth = bounds.width / layout.cols;
  const cellHeight = bounds.height / layout.rows;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 109, 42, 0.58)";
  ctx.fillStyle = "rgba(255, 109, 42, 0.92)";
  ctx.lineWidth = 1.5;
  ctx.font = "700 12px Inter, Arial, sans-serif";
  ctx.textBaseline = "top";

  for (let col = 1; col < layout.cols; col += 1) {
    const x = bounds.x + col * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, bounds.y);
    ctx.lineTo(x, bounds.y + bounds.height);
    ctx.stroke();
  }

  for (let row = 1; row < layout.rows; row += 1) {
    const y = bounds.y + row * cellHeight;
    ctx.beginPath();
    ctx.moveTo(bounds.x, y);
    ctx.lineTo(bounds.x + bounds.width, y);
    ctx.stroke();
  }

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const pageNumber = row * layout.cols + col + 1;
      const labelX = bounds.x + col * cellWidth + 10;
      const labelY = bounds.y + row * cellHeight + 10;
      const text = `Page ${pageNumber} | ${size.label}`;
      const metrics = ctx.measureText(text);

      ctx.fillStyle = "rgba(17, 17, 17, 0.78)";
      ctx.fillRect(labelX - 6, labelY - 4, metrics.width + 12, 22);
      ctx.fillStyle = "rgba(255, 109, 42, 0.96)";
      ctx.fillText(text, labelX, labelY);
    }
  }

  ctx.restore();
}

function drawBridges(ctx, bridges, selectedBridgeId) {
  bridges.forEach((bridge) => {
    ctx.save();
    ctx.translate(bridge.x, bridge.y);
    ctx.rotate((bridge.rotation * Math.PI) / 180);
    ctx.fillStyle = bridge.id === selectedBridgeId ? "rgba(255, 64, 38, 0.94)" : "rgba(188, 52, 39, 0.86)";
    ctx.strokeStyle = bridge.id === selectedBridgeId ? "#ffffff" : "rgba(255, 255, 255, 0.62)";
    ctx.lineWidth = bridge.id === selectedBridgeId ? 2.5 : 1.5;
    ctx.fillRect(-bridge.width / 2, -bridge.height / 2, bridge.width, bridge.height);
    ctx.strokeRect(-bridge.width / 2, -bridge.height / 2, bridge.width, bridge.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "800 9px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BRIDGE", 0, 0);
    ctx.restore();
  });
}

function detectStencilIslands(image, displayBounds, settings) {
  const scanWidth = Math.min(320, Math.max(24, Math.round(displayBounds.width)));
  const scanHeight = Math.max(24, Math.round((displayBounds.height / displayBounds.width) * scanWidth));
  const scanCanvas = document.createElement("canvas");
  const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
  scanCanvas.width = scanWidth;
  scanCanvas.height = scanHeight;
  scanCtx.drawImage(image, 0, 0, scanWidth, scanHeight);

  const imageData = scanCtx.getImageData(0, 0, scanWidth, scanHeight);
  const data = imageData.data;
  const visited = new Uint8Array(scanWidth * scanHeight);
  const whiteMask = new Uint8Array(scanWidth * scanHeight);
  const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));

  for (let index = 0; index < scanWidth * scanHeight; index += 1) {
    const dataIndex = index * 4;
    const gray = 0.299 * data[dataIndex] + 0.587 * data[dataIndex + 1] + 0.114 * data[dataIndex + 2];
    const adjusted = clamp(contrastFactor * (gray - 128) + 128 + settings.brightness, 0, 255);
    const cut = settings.invert ? adjusted > settings.threshold : adjusted < settings.threshold;
    whiteMask[index] = cut ? 0 : 1;
  }

  const islands = [];
  const stack = [];
  const minimumArea = Math.max(24, Math.round((scanWidth * scanHeight) * 0.0012));

  for (let start = 0; start < whiteMask.length; start += 1) {
    if (!whiteMask[start] || visited[start]) {
      continue;
    }

    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    let touchesEdge = false;
    stack.push(start);
    visited[start] = 1;

    while (stack.length) {
      const current = stack.pop();
      const x = current % scanWidth;
      const y = Math.floor(current / scanWidth);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (x === 0 || y === 0 || x === scanWidth - 1 || y === scanHeight - 1) {
        touchesEdge = true;
      }

      const neighbors = [current - 1, current + 1, current - scanWidth, current + scanWidth];
      for (const neighbor of neighbors) {
        if (
          neighbor < 0 ||
          neighbor >= whiteMask.length ||
          visited[neighbor] ||
          !whiteMask[neighbor]
        ) {
          continue;
        }

        const nx = neighbor % scanWidth;
        const ny = Math.floor(neighbor / scanWidth);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) {
          continue;
        }

        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (!touchesEdge && area >= minimumArea) {
      const scaleX = displayBounds.width / scanWidth;
      const scaleY = displayBounds.height / scanHeight;
      islands.push({
        area,
        bounds: {
          x: displayBounds.x + minX * scaleX,
          y: displayBounds.y + minY * scaleY,
          width: Math.max(10, (maxX - minX + 1) * scaleX),
          height: Math.max(10, (maxY - minY + 1) * scaleY),
        },
        center: {
          x: displayBounds.x + ((minX + maxX + 1) / 2) * scaleX,
          y: displayBounds.y + ((minY + maxY + 1) / 2) * scaleY,
        },
      });
    }
  }

  return islands.sort((a, b) => b.area - a.area).slice(0, MAX_ISLAND_WARNINGS);
}

function drawIslandWarningsOverlay(ctx, islands) {
  if (!islands.length) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 2;
  ctx.font = "800 10px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  islands.forEach((island, index) => {
    const pad = 6;
    const x = island.bounds.x - pad;
    const y = island.bounds.y - pad;
    const width = island.bounds.width + pad * 2;
    const height = island.bounds.height + pad * 2;
    ctx.strokeStyle = "rgba(255, 64, 38, 0.9)";
    ctx.fillStyle = "rgba(255, 64, 38, 0.14)";
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "rgba(17, 17, 17, 0.86)";
    ctx.fillRect(x, y - 17, 92, 17);
    ctx.fillStyle = "#ff6d2a";
    ctx.fillText(`ISLAND ${index + 1}`, x + 5, y - 15);
  });

  ctx.restore();
}

export default App;
