class BillingError(Exception):
    def __init__(self, message, *, code='BILLING_ERROR', status=400, errors=None, data=None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.errors = errors or {}
        self.data = data
