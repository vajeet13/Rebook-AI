import { sendError } from '../utils/apiResponse.js';
import { INTERNAL_SERVER_ERROR } from '../utils/errorCodes.js';

const errorHandler = (err, req, res, next) => {
  if (err.status) {
    sendError(res, err.status, err.message, err.code);
  } else {
    sendError(res, 500, 'Internal Server Error', INTERNAL_SERVER_ERROR);
  }
};

export default errorHandler;
