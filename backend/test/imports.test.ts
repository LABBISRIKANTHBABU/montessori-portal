import test from "node:test";
import assert from "node:assert/strict";
import { validateRows } from "../src/modules/imports/importService.js";

const valid = {
  admissionNo:"A-100",fullName:"Test Student",academicYear:"2026–27",board:"cbse",
  dateOfAdmission:"02/07/2026",dateOfBirth:"15/01/2015",classAdmitted:"VI",
  residenceAddress:"Test address",studentAadhaarNo:"123456789012"
};
test("legacy spreadsheet values normalize into import fields",()=>{
  const [row]=validateRows([{rowNumber:2,raw:valid}],new Set());
  assert.equal(row.status,"valid");assert.equal(row.normalized.board,"CBSE");
  assert.equal(row.normalized.dateOfAdmission,"2026-07-02");
});
test("duplicates and invalid identifiers are rejected",()=>{
  const [row]=validateRows([{rowNumber:3,raw:{...valid,studentAadhaarNo:"123"}}],new Set(["a-100"]));
  assert.equal(row.status,"duplicate");assert.ok(row.errors.some(error=>error.includes("12 digits")));
});
test("legacy placeholders normalize to missing-field errors",()=>{
  const [row]=validateRows([{rowNumber:4,raw:{...valid,residenceAddress:"-"}}],new Set());
  assert.equal(row.status,"error");assert.ok(row.errors.includes("residenceAddress is required"));
});
