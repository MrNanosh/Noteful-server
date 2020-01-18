const path = require('path');
const express = require('express');
const xss = require('xss');
const noteService = require('./note-service');

const noteRouter = express.Router();
const jsonParser = express.json();

const serializeNote = note => ({
  id: note.id,
  note_name: xss(note.note_name),
  content: xss(note.content),
  modified: note.modified,
  folder_id: note.folder_id
});

noteRouter
  .route('/')
  .get((req, res, next) => {
    noteService
      .getAllNotes(req.app.get('db')) //equals knexInstance
      .then(note => {
        res.json(
          note.map(serializeNote)
        );
      })
      .catch(next);
  })
  .post(
    jsonParser,
    (req, res, next) => {
      const {
        note_name,
        content,
        folder_id
      } = req.body;
      const newNote = {
        note_name,
        content,
        folder_id
      };

      for (const [
        key,
        value
      ] of Object.entries(newNote)) {
        if (value == null) {
          return res.status(400).json({
            error: {
              message: `Missing '${key}' in request body`
            }
          });
        }
      }
      noteService
        .insertNote(
          req.app.get('db'),
          newNote
        )
        .then(note => {
          res
            .status(201)
            .location(
              path.posix.join(
                req.originalUrl +
                  `/${note.id}`
              )
            )
            .json(serializeNote(note));
        })
        .catch(next);
    }
  );

noteRouter
  .route('/:note_id')
  .all((req, res, next) => {
    noteService
      .getById(
        req.app.get('db'),
        req.params.note_id
      )
      .then(note => {
        if (!note) {
          return res.status(404).json({
            error: {
              message:
                "note doesn't exist"
            }
          });
        }
        res.note = note; // save the note for the next middleware
        next(); // don't forget to call next so the next middleware happens!
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json(serializeNote(res.note));
  })
  .delete((req, res, next) => {
    noteService
      .deleteNote(
        req.app.get('db'),
        req.params.note_id
      )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(
    jsonParser,
    (req, res, next) => {
      const {
        note_name,
        content,
        folder_id
      } = req.body;
      const noteToUpdate = {
        note_name,
        content,
        folder_id
      };
      const numberOfValues = Object.values(
        noteToUpdate
      ).filter(Boolean).length;
      if (numberOfValues === 0) {
        return res.status(400).json({
          error: {
            message:
              "Request body must contain either 'note_name', 'folder_id' or 'content'"
          }
        });
      }
      noteService
        .updateNote(
          req.app.get('db'),
          req.params.note_id,
          noteToUpdate
        )
        .then(numRowsAffected => {
          res.status(204).end();
        })
        .catch(next);
    }
  );

module.exports = noteRouter;
