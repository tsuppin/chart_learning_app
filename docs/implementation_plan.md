# Implementation Plan - 相場師朗流・チャートめくり学習アプリ

## Goal Description

ユーザーがアップロードしたチャート画像を使い、右端を隠して少しずつめくることで、実際の相場変動をシミュレーションしながら「建玉（ポジション）」の練習ができるWebアプリケーションを開発する。

## User Review Required
>
> [!NOTE]
> 画像認識による自動判定は技術的に高難易度かつ不確実性が高いため、今回は**ユーザーによる自己申告タグ付け**（例：「ここは下半身だった」と指定）に基づき、その時の建玉操作が適切だったかを判定する形式を提案します。

## Proposed Changes

### Directory Structure

`c:\Users\tsuyoshi_tsuchiya\.gemini\antigravity\scratch\arkanoid\chart_learning_app\` (New Directory)

- `index.html`: Main application structure.
- `style.css`: Styles for the application.
- `script.js`: Application logic.

### [chart_learning_app]

#### [NEW] [index.html](file:///c%3A/Users/tsuyoshi_tsuchiya/.gemini/antigravity/scratch/arkanoid/chart_learning_app/index.html)

- **Structure**:
  - Header with title.
  - Main container with two columns (on large screens) or stacked (small screens).
  - Left/Top: Canvas container for the chart image.
  - Right/Bottom: Control panel.
    - File upload input.
    - "Next Day" button.
    - Position Input (Buy/Sell inputs).
    - "Tag Technique" dropdown (下半身, 逆下半身, etc.).
    - History list/table showing past inputs.
  - Result Modal/Section.

#### [NEW] [style.css](file:///c%3A/Users/tsuyoshi_tsuchiya/.gemini/antigravity/scratch/arkanoid/chart_learning_app/style.css)

- **Theme**: Dark pro-style theme (suitable for trading apps). Dark background, high contrast text.
- **Canvas**: Responsive canvas that fits the container.
- **Overlay**: An absolute positioned `div` or a drawn rectangle on the canvas to obscure the future chart.

#### [NEW] [script.js](file:///c%3A/Users/tsuyoshi_tsuchiya/.gemini/antigravity/scratch/arkanoid/chart_learning_app/script.js)

- **State Management**:
  - `currentStep`: Integer, current day index.
  - `totalSteps`: Integer, estimated total days (width / stepSize).
  - `stepSize`: Pixels to move per day (configurable, default to 1/30 of width).
  - `positions`: Array of objects `{ step, buy, sell, comment, technique }`.
  - `image`: The loaded Image object.
- **Functions**:
  - `loadImage(file)`: Reads file and draws to canvas.
  - `drawCanvas()`: Redraws image and overlay.
  - `nextDay()`: Advances step, saves current position input.
  - `renderOverlay()`: Draws the "hidden" part (or uses a div mask).
  - `evaluate()`: meaningful feedback based on consistency (e.g., specific technique tagged -> check if position direction matches).

## Verification Plan

### Automated Tests

- None (Visual interaction focus).

### Manual Verification

- Upload a sample chart image.
- Verify the image is loaded and 90% is hidden.
- Type "2-0" and click "Next Day".
- Verify the mask slides to the right.
- Repeat until the end.
- Verify the result overlay shows the input history.
