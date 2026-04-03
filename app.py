import os
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image, ImageEnhance
import cv2
import io
import base64

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# ─── Model Paths (Zhang et al. Colorization) ─────────────────────────────────
MODEL_DIR  = 'models'
PROTOTXT   = os.path.join(MODEL_DIR, 'colorization_deploy_v2.prototxt')
CAFFEMODEL = os.path.join(MODEL_DIR, 'colorization_release_v2.caffemodel')
KERNEL_NPY = os.path.join(MODEL_DIR, 'pts_in_hull.npy')

colorization_net = None

def load_colorization_model():
    global colorization_net
    if colorization_net is not None:
        return True
    if not (os.path.exists(PROTOTXT) and os.path.exists(CAFFEMODEL) and os.path.exists(KERNEL_NPY)):
        return False
    try:
        net    = cv2.dnn.readNetFromCaffe(PROTOTXT, CAFFEMODEL)
        pts    = np.load(KERNEL_NPY)
        class8 = net.getLayerId('class8_ab')
        conv8  = net.getLayerId('conv8_313_rh')
        pts    = pts.transpose().reshape(2, 313, 1, 1)
        net.getLayer(class8).blobs = [pts.astype(np.float32)]
        net.getLayer(conv8).blobs  = [np.full([1, 313], 2.606, dtype=np.float32)]
        colorization_net = net
        return True
    except Exception as e:
        print(f"Model load error: {e}")
        return False


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def image_to_base64(img: Image.Image, fmt='JPEG') -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=92)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


# ─── Colorization ─────────────────────────────────────────────────────────────

def colorize_with_model(pil_img: Image.Image) -> Image.Image:
    gray    = pil_img.convert('L')
    img_rgb = np.array(gray.convert('RGB')).astype(np.float32) / 255.0
    img_lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
    L       = img_lab[:, :, 0]
    L_resized = cv2.resize(L, (224, 224))
    L_resized -= 50
    net_input = L_resized[np.newaxis, np.newaxis, :, :]
    colorization_net.setInput(net_input)
    ab_dec    = colorization_net.forward()[0, :, :, :].transpose((1, 2, 0))
    ab_resized = cv2.resize(ab_dec, (pil_img.width, pil_img.height))
    lab_out   = np.concatenate([L[:, :, np.newaxis], ab_resized], axis=2)
    lab_out   = np.clip(lab_out, [0, -128, -128], [100, 127, 127])
    rgb_out   = cv2.cvtColor(lab_out.astype(np.float32), cv2.COLOR_LAB2RGB)
    rgb_out   = np.clip(rgb_out * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb_out)


def colorize_algorithmic(pil_img: Image.Image) -> Image.Image:
    gray      = np.array(pil_img.convert('L'), dtype=np.float32)
    blur      = cv2.GaussianBlur(gray, (15, 15), 0)
    edges     = cv2.Laplacian(gray, cv2.CV_32F)
    edge_norm = np.abs(edges) / (np.abs(edges).max() + 1e-6)
    r = np.clip(gray * 1.05 + blur * 0.12 - edge_norm * 8 + 12, 0, 255)
    g = np.clip(gray * 0.92 + blur * 0.08 - edge_norm * 5 + 6,  0, 255)
    b = np.clip(gray * 0.75 - blur * 0.05 - edge_norm * 3 + 2,  0, 255)
    rgb    = np.stack([r, g, b], axis=2).astype(np.uint8)
    result = Image.fromarray(rgb)
    result = ImageEnhance.Color(result).enhance(1.6)
    result = ImageEnhance.Contrast(result).enhance(1.15)
    return result


def colorize_image(pil_img: Image.Image) -> Image.Image:
    if load_colorization_model():
        return colorize_with_model(pil_img)
    return colorize_algorithmic(pil_img)


# ─── Enhancement ──────────────────────────────────────────────────────────────

def enhance_image(pil_img: Image.Image, scale: int = 2) -> Image.Image:
    cv_img   = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    denoised = cv2.bilateralFilter(cv_img, d=9, sigmaColor=75, sigmaSpace=75)
    new_w, new_h = pil_img.width * scale, pil_img.height * scale
    upscaled = cv2.resize(denoised, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    gaussian = cv2.GaussianBlur(upscaled, (0, 0), 3.0)
    sharpened = cv2.addWeighted(upscaled, 1.5, gaussian, -0.5, 0)
    kernel = np.array([[0, -0.5, 0], [-0.5, 3, -0.5], [0, -0.5, 0]])
    detail = cv2.filter2D(sharpened, -1, kernel)
    result = Image.fromarray(cv2.cvtColor(detail, cv2.COLOR_BGR2RGB))
    result = ImageEnhance.Contrast(result).enhance(1.12)
    result = ImageEnhance.Sharpness(result).enhance(1.20)
    result = ImageEnhance.Color(result).enhance(1.08)
    return result


# ─── Page Routes ──────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/studio')
def studio():
    model_available = load_colorization_model()
    return render_template('studio.html', model_available=model_available)


@app.route('/how-it-works')
def how_it_works():
    return render_template('how-it-works.html')


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.route('/api/process', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    mode    = request.form.get('mode', 'colorize')
    enhance = request.form.get('enhance', 'false') == 'true'
    try:
        scale = max(1, min(3, int(request.form.get('scale', 1))))
    except (ValueError, TypeError):
        scale = 1

    try:
        pil_img = Image.open(file.stream).convert('RGB')
        max_dim = 1024
        if max(pil_img.size) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.LANCZOS)

        original_b64 = image_to_base64(pil_img)
        result_img   = pil_img.copy()
        steps        = []

        if mode in ('colorize', 'both'):
            result_img = colorize_image(result_img)
            steps.append('Colorization')

        should_enhance = mode in ('enhance', 'both') or (mode == 'colorize' and enhance)
        if should_enhance:
            result_img = enhance_image(result_img, scale=scale)
            steps.append('Enhancement')

        result_b64 = image_to_base64(result_img)

        return jsonify({
            'success':    True,
            'original':   f'data:image/jpeg;base64,{original_b64}',
            'result':     f'data:image/jpeg;base64,{result_b64}',
            'steps':      steps if steps else ['No processing applied'],
            'model_used': 'Neural Network (Zhang et al.)' if colorization_net else 'Algorithmic Colorization',
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/model-status')
def model_status():
    available = load_colorization_model()
    return jsonify({
        'available': available,
        'message':   'Neural model loaded' if available else 'Using algorithmic fallback',
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)