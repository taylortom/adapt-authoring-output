const { App, DataStoreQuery, Module, Responder } = require('adapt-authoring-core');
const Framework = require('adapt-authoring-framework');
const fs = require('fs-extra')
const path = require('path');
const schema = require('../schema/coursebuild.schema');
/**
*/
class OutputLib {
  static listBuilds(query) {
    return getModule('mongodb').retrieve(query);
  }

  static createBuildDoc(course, dir) {
    return getModule('mongodb').create({ type: schema.name, course, dir: dir });
  }

  static build(data) {
    return wrapPromise(data, (resolve, reject) => {
      const buildDir = `${data.course}-${Date.now()}`;
      const buildPath = path.join(App.instance.getConfig('temp_dir'), buildDir);

      fs.copy(path.resolve(__dirname, '..', 'course'), path.join(buildPath, 'course'), e => {
        if(e) {
          return reject(e);
        }
        Framework.build({
          id: data.course,
          mode: 'dev',
          menu: 'adapt-contrib-boxMenu',
          theme: 'adapt-contrib-vanilla',
          dir: buildPath,
        }).then(d => {
          /** @todo proof of concept: this should probably only happen on publish */
          this.createBuildDoc(data.course, buildDir).then((d) => resolve({ build: d._id }));
        }).catch(reject);
      });
    });
  }

  static preview(data) {
    return wrapPromise(data, (resolve, reject) => {
      this.build(data).then(() => {
        resolve({ type: 'preview' });
      }).catch(reject);
    });
  }

  static download(data) {
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
      return reject(new Error(App.instance.lang.t('error.nocourseid')));
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
        return reject(new Error(App.instance.lang.t('error.unknowncourse', { courseId: data.course })));
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
