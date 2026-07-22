import uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.exceptions import R2UploadException, R2DeleteException, R2FetchException

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.R2_ENDPOINT,
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
    config=Config(
        signature_version="s3v4",
        request_checksum_calculation="when_required",
        response_checksum_validation="when_required",
    ),
)


def upload_bill_to_r2(file_buffer, invoice_no):
    """
    Receives the PDF as a byte buffer and the invoiceNo.
    Uploads to R2 and returns the unique key to save in PostgreSQL.
    """
    try:
        if hasattr(file_buffer, "seek"):
            file_buffer.seek(0)

        unique_id = str(uuid.uuid4())[:8]
        # unique_id is now actually used, so re-uploads for the same invoice
        # never collide with / silently overwrite a previous receipt's key.
        bill_pdf_key = f"mill_receipt_{invoice_no}_{unique_id}.pdf"

        s3_client.upload_fileobj(
            file_buffer,
            settings.R2_BUCKET_NAME,
            bill_pdf_key,
            ExtraArgs={
                "ContentType": "application/pdf"
            },
        )

        return bill_pdf_key
    except ClientError as e:
        print(f"R2 Upload Error: {e}")
        raise R2UploadException() from e



def delete_bill_from_r2(bill_pdf_key):
    """
    Deletes a mill receipt object from R2 by its key.
    """
    try:
        s3_client.delete_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=bill_pdf_key,
        )
        return True
    except ClientError as e:
        print(f"R2 Delete Error: {e}")
        raise R2DeleteException() from e


def get_bill_pdf_bytes(bill_pdf_key):
    """
    Takes the bill_pdf_key from PostgreSQL.
    """
    try:
        response = s3_client.get_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=bill_pdf_key,
        )
        return response["Body"].read()
    except ClientError as e:
        print(f"R2 Fetch Error: {e}")
        raise R2FetchException() from e


def get_signed_bill_url(bill_pdf_key):
    """
    Takes the bill_pdf_key from PostgreSQL.
    Generates a secure temporary URL for the frontend.
    """
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": bill_pdf_key,
            },
            ExpiresIn=120,
        )
        return url
    except ClientError as e:
        print(f"R2 URL Generation Error: {e}")
        raise R2FetchException() from e