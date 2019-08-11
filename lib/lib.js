const { App, DataStoreQuery, Responder } = require('adapt-authoring-core');
const Framework = require('adapt-authoring-framework');
const fs = require('fs-extra')
const path = require('path');
const schema = require('../schema/coursebuild.schema');
/**
* Handles Adapt framework course output
*/
class OutputLib {
  /**
  * Retrieves build metadata
  * @param {DataStoreQuery} query
  * @return {Promise}
  */
  static retrieveBuilds(query) {
    return getModule('mongodb').retrieve(query);
  }
  /**
  * Creates a new build metadata entry
  * @param {String} course Course ID
  * @param {String} dir Location of build output
  * @return {Promise}
  */
  static createBuildDoc(course, dir) {
    return getModule('mongodb').create({ type: schema.name, course, dir: dir });
  }
  /**
  *  Generates a new build
  * @param {Object} data Object defining build parameters ()
  * @param {String} data.course ID of course to build
  * @return {Promise}
  */
  static generateBuild(data) {
    return new Promise(async (resolve, reject) => {
      try {
        await validateCourse(data.course);
      } catch(e) {
        return reject(e);
      }
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
}
/** @ignore */
function validateCourse(courseId) {
  return new Promise((resolve, reject) => {
    if(!courseId) {
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
    mongodb.retrieve(new DataStoreQuery({ type: 'course', _id: courseId })).then(r => {
      if(!r.length) {
        return reject(new Error(App.instance.lang.t('error.unknowncourse', { courseId: courseId })));
      }
      resolve(r[0]);
    }).catch(reject);
  });
}
/** @ignore */
function getModule(moduleName) {
  return App.instance.getModule(moduleName);
}

module.exports = OutputLib;
