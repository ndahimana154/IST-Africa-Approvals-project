from celery import shared_task
import time


@shared_task(bind=True)
def example_long_running_task(self, item_id: int):
    """Example background task to process an item asynchronously.

    This demonstrates Celery integration. Replace with real business logic.
    """
    # Simulate work
    time.sleep(2)
    return {'item_id': item_id, 'status': 'processed'}
