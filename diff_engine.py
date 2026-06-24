import cv2
import numpy as np

def compute_difference_mask(before_img_bytes: bytes, after_img_bytes: bytes):
    """
    VyomOps Real-time physical change detection module using Computer Vision.
    Takes two raw image byte streams, synchronizes their coordinate shapes, Greyscales
    the matrices for luminance channel independence, calculates absolute pixel differences,
    and returns a visual binary damage mask, pixel divergence delta, and contour bounding coordinates.
    """
    # Convert raw bytes to standard numpy matrices
    nparr_before = np.frombuffer(before_img_bytes, np.uint8)
    nparr_after = np.frombuffer(after_img_bytes, np.uint8)
    
    img_before = cv2.imdecode(nparr_before, cv2.IMREAD_COLOR)
    img_after = cv2.imdecode(nparr_after, cv2.IMREAD_COLOR)
    
    if img_before is None or img_after is None:
        raise ValueError("Failed to decode multi-spectral visual payloads. Input image stream is corrupt.")

    # Harmonize matrix shapes using bilinear interpolations if dimension mismatch detected
    if img_before.shape != img_after.shape:
        img_after = cv2.resize(img_after, (img_before.shape[1], img_before.shape[0]))

    # Convert to grayscale to isolate pure tonal reflectivity variations
    gray_before = cv2.cvtColor(img_before, cv2.COLOR_BGR2GRAY)
    gray_after = cv2.cvtColor(img_after, cv2.COLOR_BGR2GRAY)

    # Perform absolute frame subtractions
    diff_matrix = cv2.absdiff(gray_before, gray_after)

    # Threshold the residual matrix to reject atmospheric noise and minor shadows
    _, thresh_mask = cv2.threshold(diff_matrix, 30, 255, cv2.THRESH_BINARY)

    # Compute aggregate pixel delta change score
    total_pixels = thresh_mask.shape[0] * thresh_mask.shape[1]
    non_zero_divergence = cv2.countNonZero(thresh_mask)
    change_percentage = round((non_zero_divergence / total_pixels) * 100.0, 2)

    # Resolve contour blocks for tactical drone routing alignments
    contours, _ = cv2.findContours(thresh_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bounding_boxes = []
    
    for c in contours:
        contour_area = cv2.contourArea(c)
        if contour_area > 150: # Filter out signal noises or cloud reflections
            x, y, w, h = cv2.boundingRect(c)
            bounding_boxes.append([int(x), int(y), int(w), int(h)])

    # Encode computed threshold mask back to standard bytes descriptor
    _, mask_buffer = cv2.imencode(".png", thresh_mask)
    return mask_buffer.tobytes(), change_percentage, bounding_boxes
