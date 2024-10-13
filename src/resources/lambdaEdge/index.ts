import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';

export const handler = async (
  event: CloudFrontRequestEvent,
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const origin = request.origin?.custom;

  if (origin && origin.domainName) {
    request.headers.host = [{ key: 'Host', value: origin.domainName }];
  }

  return request;
};
