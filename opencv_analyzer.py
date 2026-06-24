import sys
import os
import json
import cv2
import numpy as np

def analyze_image(image_path):
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {
                "score": 65,
                "reason": "Failed to decode image with OpenCV (possibly non-standard web format), defaulted to baseline confidence.",
                "manipulation_detected": False,
                "laplacian_variance": 0.0,
                "software_detected": []
            }
        
        # 1. Edge sharpness analysis (blur/tamper detection via Laplacian)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        edge_score = 100
        if laplacian_var < 50:
            edge_score = 60  # Very blurry, potential artificial smoothing
        elif laplacian_var > 15000:
            edge_score = 80  # Excessively sharp, artificial collage-like edges
            
        # 2. Check for duplicate pixel blocks (copy-move clone stamp detection)
        h, w = gray.shape
        grid_size = 16
        blocks = []
        for i in range(0, h - grid_size, grid_size * 4):
            for j in range(0, w - grid_size, grid_size * 4):
                block = gray[i:i+grid_size, j:j+grid_size]
                blocks.append(block)
                
        dup_count = 0
        if len(blocks) > 0:
            for idx1 in range(min(len(blocks), 30)):
                for idx2 in range(idx1 + 1, min(len(blocks), 30)):
                    # Compute mean squared error between blocks
                    mse = np.mean((blocks[idx1] - blocks[idx2]) ** 2)
                    if mse < 0.5:  # Extremely high similarity
                        dup_count += 1
                        
        dup_penalty = min(dup_count * 10, 40)
        
        # 3. Check for Photoshop/GIMP/Adobe EXIF metadata signatures in binary header
        metadata_penalty = 0
        software_detected = []
        try:
            with open(image_path, "rb") as f:
                binary_content = f.read(15000)  # Read first 15KB header
                for software in [b"Photoshop", b"GIMP", b"Adobe", b"Canva", b"PicsArt", b"Affinity"]:
                    if software in binary_content:
                        metadata_penalty += 25
                        software_detected.append(software.decode(errors='ignore'))
        except Exception:
            pass
            
        final_opencv_score = max(0, min(100, int(edge_score - dup_penalty - metadata_penalty)))
        
        analysis_details = {
            "score": final_opencv_score,
            "laplacian_variance": round(laplacian_var, 2),
            "edge_score": edge_score,
            "duplicate_blocks_found": dup_count,
            "software_detected": list(set(software_detected)),
            "manipulation_detected": dup_count > 0 or len(software_detected) > 0,
            "reason": f"OpenCV analysis completed. Laplacian edge variance is {laplacian_var:.1f}. Detected software traces: {', '.join(set(software_detected)) if software_detected else 'None'}. Clone stamp duplication similarity: found {dup_count} duplicate patterns."
        }
        return analysis_details
    except Exception as e:
        return {
            "score": 75,
            "reason": f"OpenCV processing error, fell back to 75% baseline: {str(e)}",
            "manipulation_detected": False,
            "laplacian_variance": 0.0,
            "software_detected": []
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"score": 50, "reason": "No image path provided.", "manipulation_detected": False}))
        sys.exit(0)
    image_path = sys.argv[1]
    result = analyze_image(image_path)
    print(json.dumps(result))
