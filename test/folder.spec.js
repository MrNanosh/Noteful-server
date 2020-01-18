const knex = require('knex');
const app = require('../src/app');
const {
  makeFoldersArray
} = require('./folder.fixtures');
const {
  makeNotesArray
} = require('./note.fixtures');

describe('Folder Endpoints', () => {
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
      'TRUNCATE folder, note RESTART IDENTITY CASCADE'
    )
  );
  // afterEach('test cleanup', () => {
  //   db.from('folder')
  //     .select('*')
  //     .then(rows => {
  //       console.log(rows);
  //     });
  // });
  afterEach('cleanup', () =>
    db.raw(
      'TRUNCATE folder, note RESTART IDENTITY CASCADE'
    )
  );

  describe('GET /api/folder', () => {
    context('Given no folder', () => {
      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/folder')
          .expect(200, []);
      });
    });

    context(
      'Given there are folders in the database',
      () => {
        let testFolders = makeFoldersArray();
        testFolders.forEach(
          (folder, i) => {
            folder.id = i + 1;
          }
        );

        beforeEach(
          'insert folders',
          () => {
            return db
              .into('folder')
              .insert(testFolders);
          }
        );
        it('GET /api/folder responds with 200 and all of the folders', () => {
          return supertest(app)
            .get('/api/folder')
            .expect(200, testFolders);
        });
      }
    );

    context(
      `Given an XSS attack folder`,
      () => {
        const maliciousFolder = {
          id: 911,
          folder_name:
            'Naughty naughty very naughty <script>alert("xss");</script>'
        };
        const expectedFolder = {
          ...maliciousFolder,
          folder_name:
            'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;'
        };

        beforeEach(
          'insert malicious folder',
          () => {
            return db
              .into('folder')
              .insert(maliciousFolder);
          }
        );

        it('removes XSS attack folder', () => {
          return supertest(app)
            .get(`/api/folder`)
            .expect(200)
            .expect(res => {
              expect(
                res.body[0].folder_name
              ).to.eql(
                expectedFolder.folder_name
              );
            });
        });
      }
    );
  });

  describe('GET /api/folder/:folder_id', () => {
    context('Given no folders', () => {
      it('responds with 404', () => {
        const folderId = 123456;
        return supertest(app)
          .get(
            `/api/folder/${folderId}`
          )
          .expect(404, {
            error: {
              message:
                "Folder doesn't exist"
            }
          });
      });
    });

    let testFolders = makeFoldersArray();
    testFolders.forEach((folder, i) => {
      folder.id = i + 1;
    });
    beforeEach('insert folders', () => {
      return db
        .into('folder')
        .insert(testFolders);
    });

    context(
      'Given there are folders in the database',
      () => {
        context(
          'Given an XSS attack folder',
          () => {
            const maliciousFolder = {
              id: 911,
              folder_name:
                'Naughty naughty very naughty <script>alert("xss");</script>'
            };

            beforeEach(
              'insert malicious folder',
              () => {
                return db
                  .into('folder')
                  .insert(
                    maliciousFolder
                  );
              }
            );

            it('removes XSS attack folder', () => {
              return supertest(app)
                .get(
                  `/api/folder/${maliciousFolder.id}`
                )
                .expect(200)
                .expect(res => {
                  expect(
                    res.body.folder_name
                  ).to.eql(
                    'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;'
                  );
                });
            });
          }
        );

        it('responds with 200 and the specified folder', () => {
          const folderId = 2;
          const expectedFolder =
            testFolders[folderId - 1];
          return supertest(app)
            .get(
              `/api/folder/${folderId}`
            )
            .expect(
              200,
              expectedFolder
            );
        });
      }
    );
  });

  describe('POST /api/folder', () => {
    const testFolders = makeFoldersArray();
    beforeEach('insert folder', () => {
      return db
        .into('folder')
        .insert(testFolders);
    });

    it('creates an folder, responding with 201 and the new folder', function() {
      const newFolder = {
        folder_name: 'new test folder'
      };
      return supertest(app)
        .post('/api/folder')
        .send(newFolder)
        .expect(201)
        .expect(res => {
          expect(
            res.body.folder_name
          ).to.eql(
            newFolder.folder_name
          );
          expect(
            res.body
          ).to.have.property('id');
          expect(
            res.headers.location
          ).to.eql(
            `/api/folder/${res.body.id}`
          );
        })
        .then(postRes =>
          supertest(app)
            .get(
              `/api/folder/${postRes.body.id}`
            )
            .expect(postRes.body)
        );
    });

    const newFolder = {};

    it(`responds with 400 and an error message when the 'folder_name' is missing`, () => {
      return supertest(app)
        .post('/api/folder')
        .send(newFolder)
        .expect(400, {
          error: {
            message: `Missing 'folder_name' in request body`
          }
        });
    });
  });

  it('removes XSS attack content from response', () => {
    const maliciousFolder = {
      id: 911,
      folder_name:
        'Naughty naughty very naughty <script>alert("xss");</script>'
    };
    const expectedFolder = {
      ...maliciousFolder,
      folder_name:
        'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;'
    };
    return supertest(app)
      .post('/api/folder')
      .send(maliciousFolder)
      .expect(201)
      .expect(res => {
        expect(
          res.body.folder_name
        ).to.eql(
          expectedFolder.folder_name
        );
      });
  });

  describe(`DELETE /api/folder/:folder_id`, () => {
    context(`Given no folders`, () => {
      it(`responds with 404`, () => {
        const folderId = 123456;
        return supertest(app)
          .delete(
            `/api/folder/${folderId}`
          )
          .expect(404, {
            error: {
              message: `Folder doesn't exist`
            }
          });
      });
    });
    context(
      'Given there are folders in the database',
      () => {
        const testFolders = makeFoldersArray();
        beforeEach(
          'insert folders',
          () => {
            return db
              .into('folder')
              .insert(testFolders);
          }
        );

        it('responds with 204 and removes the folder', () => {
          const idToRemove = 2;
          let expectedFolders = testFolders;
          expectedFolders.forEach(
            (folder, i) => {
              folder.id = i + 1;
            }
          );
          expectedFolders = expectedFolders.filter(
            folder => {
              return (
                folder.id !== idToRemove
              );
            }
          );
          return supertest(app)
            .delete(
              `/api/folder/${idToRemove}`
            )
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/folder`)
                .expect(expectedFolders)
            );
        });
      }
    );
  });

  describe(`PATCH /api/folder/:folder_id`, () => {
    context(`Given no folders`, () => {
      it(`responds with 404`, () => {
        const folderId = 123456;
        return supertest(app)
          .patch(
            `/api/folder/${folderId}`
          )
          .expect(404, {
            error: {
              message: `Folder doesn't exist`
            }
          });
      });
    });

    context(
      'Given there are folders in the database',
      () => {
        const testFolders = makeFoldersArray();
        beforeEach(
          'insert folders',
          () => {
            return db
              .into('folder')
              .insert(testFolders);
          }
        );

        it('responds with 204 and updates the folder', () => {
          const idToUpdate = 2;
          const updateFolder = {
            folder_name:
              'updated folder name'
          };

          const expectedFolder = {
            ...testFolders[
              idToUpdate - 1
            ],
            ...updateFolder,
            id: idToUpdate
          };
          return supertest(app)
            .patch(
              `/api/folder/${idToUpdate}`
            )
            .send(updateFolder)
            .expect(204)
            .then(res =>
              supertest(app)
                .get(
                  `/api/folder/${idToUpdate}`
                )
                .expect(expectedFolder)
            );
        });

        it(`responds with 400 when no required fields supplied`, () => {
          const idToUpdate = 2;
          return supertest(app)
            .patch(
              `/api/folder/${idToUpdate}`
            )
            .send({
              irrelevantField: 'foo'
            })
            .expect(400, {
              error: {
                message: `Request body must contain 'folder_name'`
              }
            });
        });
      }
    );
  });
});
