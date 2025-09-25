// api/_common.js
import webpush from 'web-push';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

webpush.setVapidDetails(
  VAPID_SUBJECT || 'beams-gumtree2@icloud.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export { webpush };
