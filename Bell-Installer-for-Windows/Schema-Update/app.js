var nano = require('nano')('http://127.0.0.1:5984');
var couchDBModel = require('couchdb-model');
var fs = require('fs-extra');
var async = require('async');
var dbMembers = nano.use('members');
var Member = couchDBModel(dbMembers);
var rimraf = require('rimraf');

var latestMemberModelAttribs = [
    'firstName', 'lastName', 'middleNames', 'login', 'password', 'phone', 'email', 'language', 'BirthDate', 'visits', 'Gender',
    'levels', 'status', 'yearsOfTeaching', 'teachingCredentials', 'subjectSpecialization', 'forGrades', 'community', 'region'
];

function includeAllAttribsOFLatestMemberModel(oldMemberRecord) {
    // handle the default attributes 'kind' and 'roles' first
    oldMemberRecord['kind'] = "Member"; // default value of 'kind' attrib
    if ( (!oldMemberRecord['roles']) || (!(oldMemberRecord.roles instanceof Array))
             ) { // if roles attrib does not exist, or is null, or is not an array
        oldMemberRecord['roles'] = ["Learner"]; // ['Learner'] is default value of 'roles' attrib
    } else if ( (oldMemberRecord['roles'].indexOf('SuperManager') === -1) && (oldMemberRecord['roles'].indexOf('Leader') === -1)
            && (oldMemberRecord['roles'].indexOf('Manager') === -1) ) {
        // if roles attrib does not contain any of 'SuperManager', 'Leader', 'Manager' roles in it, then it must be a non admin member
        oldMemberRecord['roles'] = ["Learner"]; // set default value of roles attrib for this member
    } else { // member has a roles array and it contains one of the 'SuperManager', 'Leader', 'Manager' roles in it
        // do nothing
    }
    // for all other attributes, just create attribs from latestMemberModelAttribs that are not present in oldMemberRecord
    for (var i in latestMemberModelAttribs) {
        var attrib = latestMemberModelAttribs[i];
        if ( (!oldMemberRecord[attrib]) ) { // if attrib does not exist, or is null
            if ( (attrib === 'forGrades') || (attrib === 'subjectSpecialization') || (attrib === 'teachingCredentials')
                    || (attrib === 'yearsOfTeaching') ) { // these four attribs happen to be null for a new member a/t latest app logic
                oldMemberRecord[attrib] = null;
            } else { // set every other attribute from latestMemberModelAttribs not found in oldMemberRecord to empty string
                oldMemberRecord[attrib] = "";
            }
        }
    }
    // create and/or set values for 'community' and 'region' attribs
    oldMemberRecord['community'] = 'Ifo'; // assuming this script is for Ifo, Dadaab
    oldMemberRecord['region'] = 'Dadaab';
    console.log('updated member record!');
}

function processAllMemberRecordsFromLocalCouch() {
    Member.findAll(function(error, results) { // result is an array of model instances
        var context = this;
        if (error) {
            console.error('failed to fetch all documents from members db');
        }
        else {
            async.eachSeries(results, function (member, callback) {
                if ( member._id !== '_design/bell' ) { // record and member record is a genuine one, i-e not a design doc
                    console.log('Member: "' + member.firstName + ' ' + member.lastName + '" (id ' + member._id + ')');
                    includeAllAttribsOFLatestMemberModel(member);
                    if (!member._attachments) { // member does NOT have attachments in his profile/record
                        member.save(function(error) {
                            if (error) {
                                console.error('failed to save document');
                                callback(error);
                            }
                            console.log(member._id +' does NOT have a profile pic');
                            console.log('continue to next member');
                            callback();
                        });
                    } else { // member has attachment(s) in his profile/record
                        var attchments = member._attachments;
                        var attachedFileName = Object.keys(attchments)[0];
                        var attachmentFilePath = 'downloads/' + attachedFileName;
                        console.log(member._id + ' has a profile pic file named: ' + attachedFileName);
                        dbMembers.attachment.get(member._id, attachedFileName, function (err, body) {
                            if (err) {
                                callback(err);
                            }
                            fs.outputFile(attachmentFilePath, body, function (err) {
                                if (err) {
                                    callback(err);
                                }
                                console.log('file written successfully to downloads folder');
                                member.save(function (error) {
                                    if (error) {
                                        console.error('failed to save document');
                                        callback(error);
                                    }
                                    console.log('member record, minus profile pic, saved with id: ' + member._id);
                                    // fetch the document again to get latest '_rev'
                                    Member.findOneByID(member._id, function (error, result) {
                                        if (error) {
                                            console.error('failed to refetch the member document');
                                            callback(error);
                                        }
                                        fs.readFile(attachmentFilePath, function (err, data) {
                                            if (err) {
                                                console.error('failed to read the downloaded file ' + attachmentFilePath);
                                                callback(err);
                                            }
                                            dbMembers.attachment.insert(result._id, attachedFileName, data, 'image',
                                                { rev: result._rev }, function (err, body) {
                                                    if (err) {
                                                        console.error('failed to upload file ' + attachmentFilePath + ' into member record');
                                                        callback(err);
                                                    }
                                                    // now delete the file from the local folder where it
                                                    // was written temporarily
                                                    rimraf(attachmentFilePath, function (err) {
                                                        if (err) {
                                                            callback(err);
                                                        }
                                                        console.log(attachmentFilePath + ' file deleted after successful upload');
                                                        console.log('take on the next member');
                                                        callback();
                                                    });
                                                });
                                        });
                                    });
                                });
                            });
                        });
                    }
                } else { // continue to next iteration when if branch was not taken
                    console.log('its a design doc (id: ' + member._id + ')');
                    console.log('continue to next record');
                    callback();
                }
            }, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('all member records updated!!!');
                }
            });
        }
    });
}

processAllMemberRecordsFromLocalCouch();