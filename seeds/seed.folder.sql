BEGIN;
INSERT INTO folder (folder_name)
  VALUES ('Cute!'), ('Delishious!'), ('Scary!');
INSERT INTO note (note_name, modified, content, folder_id)
  VALUES ('Dogs', '2019-01-03T00:00:00.000Z', 'Puppies...Yaaayy!', 1), ('Cats', '2018-08-15T23:00:00.000Z', 'Kitty...Yaaayy!', 1), ('Pigs', '2018-03-01T00:00:00.000Z', 'Pigs....Bacon!', 2), ('Chickens', '2019-01-03T00:00:00.000Z', 'Mmm...Chicken!', 2), ('Bear', '2019-01-03T00:00:00.000Z', 'Bears...OH My!', 3), ('Lion', '2019-01-03T00:00:00.000Z', 'Lions...OH MY!', 3), ('Tiger', '2019-01-03T00:00:00.000Z', 'Tigers...OH MY!', 3);
COMMIT;

