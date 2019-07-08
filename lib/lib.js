const { App, DataStoreQuery, Module, Responder } = require('adapt-authoring-core');
const Framework = require('adapt-authoring-framework');
const path = require('path');
const schema = require('../schema/coursebuild.schema');
/**
*/
class OutputLib {
  static listBuilds(query) {
    return getModule('mongodb').retrieve(query);
  }

  static build(data) {
    return wrapPromise(data, (resolve, reject) => {
      const buildDir = `${data.course}-${Date.now()}`;
      Framework.build({
        id: data.course,
        mode: 'prod',
        args: [],
        dir: path.join(App.instance.env.aat_temp_dir, buildDir),
      })
        .then(d => {
          /** @todo proof of concept: this should probably only happen on publish */
          getModule('mongodb').create({
            type: schema.name,
            course: data.course,
            dir: buildDir
          });
        })
        .then(resolve)
        .catch(e => reject(e));
    });
  }

  static previewCourse(data) {
    return wrapPromise(data, (resolve, reject) => {
      this.build(data).then(() => {
        resolve({ type: 'preview' });
      }).catch(reject);
    });
  }

  static downloadCourse(data) {
    return wrapPromise(data, (resolve, reject) => {
      this.build(data).then(() => {
        resolve({ type: 'download' });
      }).catch(reject);
    });
  }
}

function wrapPromise(data, cb) {
  return new Promise((resolve, reject) => {
    if(!data.course) {
      return reject(new Error('Must specify a course id'));
    }
    const courses = getModule('courses');
    const mongodb = getModule('mongodb');
    let courseModel;
    try {
      courseModel = courses.constructor.def.model;
    } catch(e) {
      reject(e);
    }
    mongodb.retrieve(new DataStoreQuery({ type: 'course', _id: data.course })).then(r => {
      if(!r.length) {
        return reject(new Error(`No course with id '${data.course}'`));
      }
      new Promise(cb)
        .then(d => resolve(d))
        .catch(e => reject(e));
    }).catch(reject);
  });
}

function getModule(moduleName) {
  return App.instance.getModule(moduleName);
}

module.exports = OutputLib;
