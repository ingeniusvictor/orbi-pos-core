# OC-07 — Shared Product Image Library

## Goal

Let the El Chunchito pilot use premium product photography or generated promotional images without depending on third-party image hosting.

## Architecture

Images are stored by the ORBI LAN sync server, not inside the catalog JSON.

```text
Admin browser
    |
    | upload JPG / PNG / WebP
    v
ORBI Sync Server
    |
    +-- data/stores/el-chunchito/assets/<unique-file>
    |
    +-- stable /api/.../assets/<file> URL
                   |
                   +----> ORBI POS
                   +----> ORBI Showcase TV
```

The catalog stores only the image URL.

## Supported image types

- JPEG
- PNG
- WebP

Maximum upload size: **12 MB**.

The server validates:

- safe store id;
- safe generated filename;
- extension/content-type agreement;
- maximum size;
- basic binary image signature.

This prevents arbitrary filesystem paths and rejects payloads that merely claim to be images.

## Showcase administration

The **Contenido TV** workspace now supports:

- uploading a new image directly from the browser;
- seeing recent images in the shared library;
- selecting an already-uploaded image for another product;
- using an external image URL when appropriate;
- previewing the assigned image immediately;
- saving the product-image association through the shared catalog.

## Cache behavior

Uploaded asset filenames are unique and immutable. The server therefore sends long-lived browser cache headers for image files.

Replacing a product image means assigning a new asset URL rather than overwriting the old file.

## LAN boundary

OC-07 remains a trusted-local-network pilot feature.

The image upload API has no public-internet authentication yet and must not be exposed directly outside the trusted pilot network.

## Image content workflow

The intended future workflow for premium Showcase content is:

1. create or photograph the product image;
2. export as WebP/JPEG/PNG;
3. upload from **Showcase -> Contenido TV**;
4. assign to the product;
5. save the Showcase content;
6. the wall TV receives the shared catalog reference and loads the image from the ORBI host.

This lets ORBI-generated 16:9 promotional imagery and real product photos coexist without changing the product model.
