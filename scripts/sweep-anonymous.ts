import { sweepAnonymousUsers } from '../lib/db/anonymous.ts';
import { databaseUrl } from '../lib/db/client.ts';
import { photoDir } from '../lib/photos/store.ts';
import { sweepPhotos } from '../lib/photos/sweep.ts';

const run = async () => {
  console.log(`Sweeping anonymous records in ${databaseUrl()}`);
  const { users, armies, shares } = await sweepAnonymousUsers();
  console.log(
    `  ${users} anonymous records, ${armies} lists, ${shares} unseen share links`,
  );
  console.log(`Reconciling collection photos in ${photoDir()}`);
  const photos = await sweepPhotos();
  console.log(
    `  ${photos.files} files with no row, ${photos.rows} rows with no files`,
  );
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
