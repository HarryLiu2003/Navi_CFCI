"""
Error handling classes for the interview analysis service.
"""

class InterviewAnalysisError(Exception):
    """Base exception for all interview analysis errors."""
    def __init__(self, message, status_code=500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class FileProcessingError(InterviewAnalysisError):
    """Error in file processing."""
    def __init__(self, message):
        super().__init__(message, status_code=400)


class AnalysisError(InterviewAnalysisError):
    """Error during analysis."""
    def __init__(self, message):
        super().__init__(message, status_code=500)


class StorageError(InterviewAnalysisError):
    """Error during storage."""
    def __init__(self, message):
        super().__init__(message, status_code=500)


class NotFoundError(InterviewAnalysisError):
    """Error when a requested resource is not found."""
    def __init__(self, message):
        super().__init__(message, status_code=404)


class WorkflowError(InterviewAnalysisError):
    """Error during workflow execution."""
    def __init__(self, message):
        super().__init__(message, status_code=500)


class ConfigurationError(InterviewAnalysisError):
    """Error in service configuration."""
    def __init__(self, message):
        super().__init__(message, status_code=503)  # Service Unavailable 