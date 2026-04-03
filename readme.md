# ChromaClear 🎨

**AI-powered image colorization & restoration**

Transform black-and-white photographs into vivid colour, then push further with super-resolution and noise reduction.

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## Optional: Neural Colorization Model

By default ChromaClear uses its built-in **algorithmic colorization engine** (warm-tone luminance mapping). For photorealistic results powered by deep learning (Zhang et al. 2016), download the pre-trained Caffe model:

```bash
mkdir -p models && cd models

# 1. Prototxt (architecture)
curl -L "https://raw.githubusercontent.com/richzhang/colorization/caffe/models/colorization_deploy_v2.prototxt" \
     -o colorization_deploy_v2.prototxt

# 2. Caffe weights (~125 MB)
curl -L "http://eecs.berkeley.edu/~rich.zhang/projects/2016_colorization/files/demo_v2/colorization_release_v2.caffemodel" \
     -o colorization_release_v2.caffemodel

# 3. Cluster centres
curl -L "https://github.com/richzhang/colorization/raw/caffe/resources/pts_in_hull.npy" \
     -o pts_in_hull.npy
```

Restart the server — the status indicator in the top nav will turn **cyan** when the neural model is active.

---

## Features

| Feature | Description |
|---------|-------------|
| **Deep Colorization** | Zhang et al. ECCV 2016 neural colorization via OpenCV DNN |
| **Algorithmic Fallback** | Warm luminance-guided colorization (no model needed) |
| **Bilateral Denoising** | Edge-preserving noise reduction via OpenCV |
| **Lanczos Super-Resolution** | 1×, 2×, 3× upscaling with perceptual sharpening |
| **Unsharp Masking** | Detail recovery for aged/compressed photographs |
| **Interactive Compare Slider** | Drag to compare before/after in the browser |
| **Full Pipeline Mode** | Colorize → Denoise → Upscale in one click |

## Project Structure

```
chromaclear/
├── app.py              # Flask backend
├── requirements.txt
├── models/             # Place Caffe model files here
│   ├── colorization_deploy_v2.prototxt
│   ├── colorization_release_v2.caffemodel
│   └── pts_in_hull.npy
├── templates/
│   └── index.html      # Main UI
├── static/
│   ├── css/style.css
│   └── js/main.js
├── uploads/            # Temp uploads (auto-created)
└── outputs/            # Temp outputs (auto-created)
```

## Tech Stack

- **Backend**: Python · Flask · OpenCV · Pillow · NumPy
- **Colorization**: Zhang et al. (2016) ECCV via `cv2.dnn`
- **Enhancement**: OpenCV bilateral filter · Lanczos upscaling · USM sharpening
- **Frontend**: Vanilla HTML/CSS/JS — no framework needed