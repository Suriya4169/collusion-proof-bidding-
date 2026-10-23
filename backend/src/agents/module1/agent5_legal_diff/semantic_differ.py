from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Any

# Load the model once globally (it's around ~80MB, will cache in ~/.cache/huggingface)
print("[Semantic Differ] Loading SentenceTransformer model (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')

def compute_semantic_diff(original_clauses: List[str], amended_clauses: List[str], similarity_threshold: float = 0.75) -> List[Dict[str, Any]]:
    """
    Sub-Agent 5.2: Semantic Differ
    Compares two lists of clauses using mathematically encoded vector embeddings.
    Flags any clauses where the cosine similarity drops below the threshold.
    """
    if not original_clauses or not amended_clauses:
        return []

    print(f"[Sub-Agent 5.2] Encoding {len(original_clauses)} original clauses...")
    original_embeddings = model.encode(original_clauses)
    
    print(f"[Sub-Agent 5.2] Encoding {len(amended_clauses)} amended clauses...")
    amended_embeddings = model.encode(amended_clauses)
    
    # Compute the pairwise cosine similarity matrix
    # Shape: (len(original_clauses), len(amended_clauses))
    similarity_matrix = cosine_similarity(original_embeddings, amended_embeddings)
    
    flagged_pairs = []
    
    # For every original clause, find the most similar amended clause
    for i, orig_clause in enumerate(original_clauses):
        # Find the max similarity in the row corresponding to this original clause
        best_match_idx = np.argmax(similarity_matrix[i])
        best_match_score = similarity_matrix[i][best_match_idx]
        
        # If the best match is below 0.99, it means it was altered (or deleted).
        # We specifically flag things below 0.75 as potentially corrupt (semantics changed significantly).
        if best_match_score < similarity_threshold:
            flagged_pairs.append({
                "original_clause": orig_clause,
                "amended_clause": amended_clauses[best_match_idx],
                "similarity_score": float(best_match_score)
            })
            
    print(f"[Sub-Agent 5.2] Found {len(flagged_pairs)} suspicious alterations.")
    return flagged_pairs

if __name__ == "__main__":
    # Test block
    from clause_extractor import extract_for_comparison
    import sys
    sys.path.append("../../../..") # Quick hack for local testing
    
    orig = "../../../../test_data/GeM-Bidding-9292805.pdf"
    corr = "../../../../test_data/GeM-Bidding-9292805-CORRIGENDUM.pdf"
    
    clauses = extract_for_comparison(orig, corr)
    flagged = compute_semantic_diff(clauses["original_clauses"], clauses["amended_clauses"])
    
    for f in flagged[:3]:
        print(f"--- FLAGGED (Score: {f['similarity_score']:.2f}) ---")
        print(f"ORIG: {f['original_clause']}")
        print(f"NEW : {f['amended_clause']}\n")
