const path = require('path');
const express = require('express');
const xss = require('xss');
const FolderService = require('./folder-service');

const folderRouter = express.Router();
const jsonParser = express.json();

const serializeFolder = folder => ({
  id: folder.id,
  folder_name: xss(folder.folder_name)
});

folderRouter
  .route('/')
  .get((req, res, next) => {
    FolderService.getAllFolders(
      req.app.get('db')
    ) //equals knexInstance
      .then(folders => {
        res.json(
          folders.map(serializeFolder)
        );
      })
      .catch(next);
  })
  .post(
    jsonParser,
    (req, res, next) => {
      const { folder_name } = req.body;
      const newFolder = {
        folder_name
      };

      for (const [
        key,
        value
      ] of Object.entries(newFolder)) {
        if (!value) {
          return res.status(400).json({
            error: {
              message: `Missing '${key}' in request body`
            }
          });
        }
      }

      FolderService.insertFolder(
        req.app.get('db'),
        newFolder
      )
        .then(folder => {
          res
            .status(201)
            .location(
              path.posix.join(
                req.originalUrl +
                  `/${folder.id}`
              )
            )
            .json(
              serializeFolder(folder)
            );
        })
        .catch(next);
    }
  );

folderRouter
  .route('/:folder_id')
  .all((req, res, next) => {
    FolderService.getById(
      req.app.get('db'),
      req.params.folder_id
    )
      .then(folder => {
        if (!folder) {
          return res.status(404).json({
            error: {
              message:
                "Folder doesn't exist"
            }
          });
        }
        res.folder = folder; // save the folder for the next middleware
        next(); // don't forget to call next so the next middleware happens!
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json(
      serializeFolder(res.folder)
    );
  })
  .delete((req, res, next) => {
    FolderService.deleteFolder(
      req.app.get('db'),
      req.params.folder_id
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(
    jsonParser,
    (req, res, next) => {
      const { folder_name } = req.body;
      const folderToUpdate = {
        folder_name
      };
      const numberOfValues = Object.values(
        folderToUpdate
      ).filter(Boolean).length;
      if (numberOfValues === 0) {
        return res.status(400).json({
          error: {
            message:
              "Request body must contain 'folder_name'"
          }
        });
      }
      FolderService.updateFolder(
        req.app.get('db'),
        req.params.folder_id,
        folderToUpdate
      )
        .then(numRowsAffected => {
          res.status(204).end();
        })
        .catch(next);
    }
  );

module.exports = folderRouter;
