from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler that formats responses and logs errors."""
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize error response structure
        data = {
            'error': {
                'detail': response.data,
                'status_code': response.status_code,
            }
        }
        return Response(data, status=response.status_code)

    # Non-DRF exceptions get logged and return a 500
    logger.exception('Unhandled exception: %s', exc)
    return Response({'error': {'detail': 'Internal server error'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
