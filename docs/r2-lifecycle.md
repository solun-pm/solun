# R2 Lifecycle + CORS

This project relies on R2 lifecycle rules as a fallback safety net.

## Lifecycle Rules (Fallback)

Configure two rules:

1) Abort incomplete multipart uploads after 1 day.
2) Delete objects with the prefix `files/` after 8 days.

Example JSON (S3-compatible lifecycle configuration):

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-uploads",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 1
      }
    },
    {
      "ID": "expire-managed-objects",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "files/"
      },
      "Expiration": {
        "Days": 8
      }
    }
  ]
}
```

## CORS Rules (Browser Uploads/Downloads)

R2 needs CORS for direct browser PUT/GET requests (multipart uploads and ranged downloads).

Example:

```json
[
  {
    "AllowedOrigins": [
      "https://your-frontend.example"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Range",
      "x-amz-*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

Notes:
- `Range` is required for chunked downloads.
- `ETag` is required to complete multipart uploads.
- Tag-based lifecycle rules are not supported by R2 via the S3 API. Use a prefix filter instead.
- Keep lifecycle rules even if the API cleanup job is running.
