const knex = require('knex');
const app = require('../src/app');
const {
  makeNotesArray
} = require('./note.fixtures');
const {
  makeFoldersArray
} = require('./folder.fixtures');

describe('Note Endpoints', function() {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection:
        process.env.TEST_DATABASE_URL
    });
    app.set('db', db);
  });

  after('disconnect from db', () =>
    db.destroy()
  );

  before('clean the table', () =>
    db.raw(
      'TRUNCATE note, folder RESTART IDENTITY CASCADE'
    )
  );
  afterEach('cleanup', () =>
    db.raw(
      'TRUNCATE note, folder RESTART IDENTITY CASCADE'
    )
  );
  describe('GET /api/notes', () => {
    context('Given no notes', () => {
      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/note')
          .expect(200, []);
      });
    });

    context(
      'Given there are notes in the database',
      () => {
        const testNotes = makeNotesArray();
        const testFolders = makeFoldersArray();

        beforeEach(
          'insert notes',
          () => {
            return db
              .into('folder')
              .insert(testFolders)
              .then(() => {
                return db
                  .into('note')
                  .insert(testNotes);
              });
          }
        );

        it('GET /api/note responds with 200 and all of the notes', () => {
          return supertest(app)
            .get('/api/note')
            .expect(200, testNotes);
        });
      }
    );
    context(
      `Given an XSS attack note`,
      () => {
        const maliciousNote = {
          id: 911,
          note_name:
            'Naughty naughty very naughty <script>alert("xss");</script>',
          folder_id: 1,
          content:
            'Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.'
        };
        const expectedNote = {
          ...maliciousNote,
          note_name:
            'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;',
          content: `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
        };

        const testFolders = makeFoldersArray();
        beforeEach(
          'insert malicious note',
          () => {
            return db
              .into('folder')
              .insert(testFolders)
              .then(() => {
                return db
                  .into('note')
                  .insert(
                    maliciousNote
                  );
              });
          }
        );

        it('removes XSS attack content', () => {
          return supertest(app)
            .get(`/api/note`)
            .expect(200)
            .expect(res => {
              expect(
                res.body[0].note_name
              ).to.eql(
                expectedNote.note_name
              );
              expect(
                res.body[0].content
              ).to.eql(
                expectedNote.content
              );
            });
        });
      }
    );
  });

  describe('GET /api/note/:note_id', () => {
    context('Given no note', () => {
      it('responds with 404', () => {
        const noteId = 123456;
        return supertest(app)
          .get(`/api/note/${noteId}`)
          .expect(404, {
            error: {
              message:
                "note doesn't exist"
            }
          });
      });
    });
    context(
      'Given there are notes in the database',
      () => {
        context(
          'Given an XSS attack note',
          () => {
            const testFolders = makeFoldersArray();
            const maliciousNote = {
              id: 911,
              note_name:
                'Naughty naughty very naughty <script>alert("xss");</script>',
              folder_id: 2,
              content:
                'Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.'
            };

            beforeEach(
              'insert malicious note',
              () => {
                return db
                  .into('folder')
                  .insert(testFolders)
                  .then(() => {
                    return db
                      .into('note')
                      .insert(
                        maliciousNote
                      );
                  });
              }
            );

            it('removes XSS attack content', () => {
              return supertest(app)
                .get(
                  `/api/note/${maliciousNote.id}`
                )
                .expect(200)
                .expect(res => {
                  expect(
                    res.body.note_name
                  ).to.eql(
                    'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;'
                  );
                  expect(
                    res.body.content
                  ).to.eql(
                    'Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.'
                  );
                });
            });
          }
        );

        const testFolders = makeFoldersArray();
        const testNotes = makeNotesArray();
        beforeEach(
          'insert notes',
          () => {
            return db
              .into('folder')
              .insert(testFolders)
              .then(() => {
                return db
                  .into('note')
                  .insert(testNotes);
              });
          }
        );

        it('responds with 200 and the specified note', () => {
          const noteId = 2;
          const expectedNote =
            testNotes[noteId - 1];

          return supertest(app)
            .get(`/api/note/${noteId}`)
            .expect(200, expectedNote);
        });
      }
    );
  });

  describe('POST /api/note', () => {
    const testFolders = makeFoldersArray();
    beforeEach('insert folders', () => {
      return db
        .into('folder')
        .insert(testFolders);
    });

    it('creates an note, responding with 201 and the new note', function() {
      this.retries(3);
      const newNote = {
        note_name: 'Test new note',
        folder_id: 2,
        content:
          'Test new note content...'
      };
      return supertest(app)
        .post('/api/note')
        .send(newNote)
        .expect(201)
        .expect(res => {
          expect(
            res.body.note_name
          ).to.eql(newNote.note_name);
          expect(
            res.body.folder_id
          ).to.eql(newNote.folder_id);
          expect(
            res.body.content
          ).to.eql(newNote.content);
          expect(
            res.body
          ).to.have.property('id');
          expect(
            res.headers.location
          ).to.eql(
            `/api/note/${res.body.id}`
          );
          const expected = new Date().toLocaleString(
            'en',
            { timeZone: 'UTC' }
          ); //solution changes these 2 consts
          const actual = new Date(
            res.body.modified
          ).toLocaleString();
          expect(actual).to.eql(
            expected
          );
        })
        .then(postRes =>
          supertest(app)
            .get(
              `/api/note/${postRes.body.id}`
            )
            .expect(postRes.body)
        );
    });

    const requiredFields = [
      'note_name',
      'folder_id'
    ];

    requiredFields.forEach(field => {
      const newNote = {
        note_name: 'Test new note',
        folder_id: 2,
        content:
          'Test new note content...'
      };

      it(`responds with 400 and an error message when the '${field}' is missing`, () => {
        delete newNote[field];
        return supertest(app)
          .post('/api/note')
          .send(newNote)
          .expect(400, {
            error: {
              message: `Missing '${field}' in request body`
            }
          });
      });
    });

    it('removes XSS attack content from response', () => {
      const maliciousNote = {
        id: 911,
        note_name:
          'Naughty naughty very naughty <script>alert("xss");</script>',
        folder_id: 1,
        content:
          'Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.'
      };

      const expectedNote = {
        ...maliciousNote,
        note_name:
          'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;',
        content: `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
      };

      return supertest(app)
        .post('/api/note')
        .send(maliciousNote)
        .expect(201)
        .expect(res => {
          expect(
            res.body.note_name
          ).to.eql(
            expectedNote.note_name
          );
          expect(
            res.body.content
          ).to.eql(
            expectedNote.content
          );
        });
    });
  });

  describe(`DELETE /api/note/:note_id`, () => {
    context(`Given no notes`, () => {
      it(`responds with 404`, () => {
        const noteId = 123456;
        return supertest(app)
          .delete(`/api/note/${noteId}`)
          .expect(404, {
            error: {
              message: `note doesn't exist`
            }
          });
      });
    });
    context(
      'Given there are notes in the database',
      () => {
        const testNotes = makeNotesArray();
        const testFolders = makeFoldersArray();
        beforeEach(
          'insert notes',
          () => {
            return db
              .into('folder')
              .insert(testFolders)
              .then(() => {
                return db
                  .into('note')
                  .insert(testNotes);
              });
          }
        );
        it('responds with 204 and removes the note', () => {
          const idToRemove = 2;
          const expectedNotes = testNotes.filter(
            note =>
              note.id !== idToRemove
          );
          return supertest(app)
            .delete(
              `/api/note/${idToRemove}`
            )
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/note`)
                .expect(expectedNotes)
            );
        });
      }
    );
  });

  describe(`PATCH /api/note/:note_id`, () => {
    context(`Given no notes`, () => {
      it(`responds with 404`, () => {
        const noteId = 123456;
        return supertest(app)
          .patch(`/api/note/${noteId}`)
          .expect(404, {
            error: {
              message: `note doesn't exist`
            }
          });
      });
    });
    context(
      'Given there are notes in the database',
      () => {
        const testNotes = makeNotesArray();
        const testFolders = makeFoldersArray();
        beforeEach(
          'insert notes',
          () => {
            return db
              .into('folder')
              .insert(testFolders)
              .then(() => {
                return db
                  .into('note')
                  .insert(testNotes);
              });
          }
        );

        it('responds with 204 and updates the note', () => {
          const idToUpdate = 2;
          const updateNote = {
            note_name:
              'updated note name',
            folder_id: 2,
            content:
              'updated note content'
          };
          const expectedNote = {
            ...testNotes[
              idToUpdate - 1
            ],
            ...updateNote
          };
          return supertest(app)
            .patch(
              `/api/note/${idToUpdate}`
            )
            .send(updateNote)
            .expect(204)
            .then(res =>
              supertest(app)
                .get(
                  `/api/note/${idToUpdate}`
                )
                .expect(expectedNote)
            );
        });

        it(`responds with 400 when no required fields supplied`, () => {
          const idToUpdate = 2;
          return supertest(app)
            .patch(
              `/api/note/${idToUpdate}`
            )
            .send({
              irrelevantField: 'foo'
            })
            .expect(400, {
              error: {
                message: `Request body must contain either 'note_name', 'folder_id' or 'content'`
              }
            });
        });
        it(`responds with 204 when updating only a subset of fields`, () => {
          const idToUpdate = 2;
          const updateNote = {
            note_name:
              'updated note title'
          };
          const expectedNote = {
            ...testNotes[
              idToUpdate - 1
            ],
            ...updateNote
          };

          return supertest(app)
            .patch(
              `/api/note/${idToUpdate}`
            )
            .send({
              ...updateNote,
              fieldToIgnore:
                'should not be in GET response'
            })
            .expect(204)
            .then(res =>
              supertest(app)
                .get(
                  `/api/note/${idToUpdate}`
                )
                .expect(expectedNote)
            );
        });
      }
    );
  });
});
