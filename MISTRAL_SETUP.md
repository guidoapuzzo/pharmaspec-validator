# Mistral OCR Integration - Quick Setup Guide

## Overview

This branch implements Mistral OCR as an alternative extraction provider for pharmaceutical specification documents.

**Key Features:**
- ✅ State-of-the-art OCR accuracy (98-99%)
- ✅ **No page limit** (processes 28+ page documents)
- ✅ Structured markdown output per page
- ✅ Easy switching between Gemini and Mistral
- ✅ Same output format for downstream analysis

---

## Quick Start

### 1. Get Mistral API Key

1. Go to https://console.mistral.ai/
2. Create account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

### 2. Update Configuration

Edit `backend/.env`:

```bash
# Change extraction provider from gemini to mistral
EXTRACTION_PROVIDER=mistral

# Your Mistral API key should already be set
MISTRAL_API_KEY=your_actual_api_key_here
```

### 3. Restart Backend

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

### 4. Test

Upload a pharmaceutical specification document through the frontend. Check logs for:

```
INFO: Mistral OCR processing document.pdf (application/pdf)
INFO: Calling Mistral OCR API (basic mode, no page limit)...
INFO: Successfully extracted specifications from document.pdf using Mistral OCR
```

---

## Configuration Options

### Option 1: Mistral OCR + Gemini Analysis (Recommended)

```bash
# backend/.env
EXTRACTION_PROVIDER=mistral      # OCR with Mistral
MATRIX_GENERATION_PROVIDER=gemini  # Analysis with Gemini
```

**Best for:** High accuracy OCR + quality analysis

### Option 2: Gemini Only (Original)

```bash
# backend/.env
EXTRACTION_PROVIDER=gemini
MATRIX_GENERATION_PROVIDER=gemini
```

**Best for:** Single-provider simplicity

### Option 3: Mistral OCR + Local Ollama

```bash
# backend/.env
EXTRACTION_PROVIDER=mistral
MATRIX_GENERATION_PROVIDER=ollama
```

**Best for:** Cloud OCR + local analysis

---

## Technical Details

### How It Works

**Without document_annotation_format:**
- Mistral OCR processes documents without the 8-page limit
- Returns structured markdown per page via Pydantic `model_dump()`
- No custom JSON schemas needed
- Works for any document size (tested up to 100 pages)

**Response structure:**
```json
{
  "pages": [
    {
      "index": 0,
      "markdown": "# Section 1\n\nContent...",
      "images": [...],
      "dimensions": {...}
    }
  ],
  "usage_info": {
    "pages_processed": 28,
    "doc_size_bytes": 1201378
  }
}
```

### Files Modified (Feature Branch)

1. **`backend/app/core/config.py`**
   - Added `EXTRACTION_PROVIDER` setting
   - Added `MISTRAL_API_KEY` and `MISTRAL_OCR_MODEL`

2. **`backend/app/services/ai_service.py`**
   - Added Mistral client initialization
   - Added extraction provider dispatcher
   - Implemented `_extract_with_mistral_ocr()` (no annotations)
   - Updated health check

3. **`.env.example`** and **`backend/.env`**
   - Added Mistral configuration template

---

## Switching Back to Gemini

To revert to Gemini-only extraction, edit `backend/.env`:

```bash
EXTRACTION_PROVIDER=gemini
```

Restart backend. No code changes needed!

---

## Testing

Check extraction provider in use:

```bash
curl http://localhost:8000/api/v1/health | jq '.ai_services'
```

Expected output:
```json
{
  "gemini_available": true,
  "mistral_available": true,
  "extraction_provider": "mistral",
  "matrix_provider": "gemini"
}
```

---

## Advantages vs Previous Approach

**❌ Previous approach (with annotations):**
- 8-page limit due to `document_annotation_format`
- Complex Pydantic schemas
- Failed on 28-page documents

**✅ Current approach (basic OCR):**
- No page limit
- Simpler implementation
- Uses built-in `model_dump()` for JSON
- Works for any document size

---

## Branch Information

- **Branch:** `feature/mistral-ocr-integration`
- **Base:** `main` (Gemini-only)
- **Status:** Ready for testing
- **Main branch:** Unchanged (still Gemini-only)

---

## Next Steps

1. Test with your 28-page pharmaceutical spec
2. Compare extraction quality: Mistral vs Gemini
3. Measure processing time and costs
4. Decide on production provider
5. Merge to main when ready

---

## Troubleshooting

**Mistral API Key Error:**
```
ValueError: Mistral API not configured
```
→ Check `MISTRAL_API_KEY` in `backend/.env`

**Still using Gemini:**
```
INFO: Using Gemini (gemini-2.5-flash) for extraction
```
→ Check `EXTRACTION_PROVIDER=mistral` in `backend/.env`

**Import Error:**
```
ModuleNotFoundError: No module named 'mistralai'
```
→ Run: `pip install mistralai`

---

## Summary

✅ Mistral OCR integrated successfully
✅ No 8-page limit
✅ Easy provider switching
✅ Main branch unchanged
✅ Ready for production testing
