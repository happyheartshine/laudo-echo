// @ts-ignore
import dicomParser from "dicom-parser";

export interface DicomPatientInfo {
  nome: string;
  responsavel: string;
  especie: string;
  raca: string;
  sexo: string;
  idade: string;
  peso: string;
}

// DICOM tags for patient information
// See: https://dicom.innolitics.com/ciods
const TAGS = {
  PatientName: "x00100010",
  PatientID: "x00100020",
  PatientBirthDate: "x00100030",
  PatientSex: "x00100040",
  PatientAge: "x00101010",
  PatientWeight: "x00101030",
  PatientSpeciesDescription: "x00102201",
  PatientBreedDescription: "x00102292",
  ReferringPhysicianName: "x00080090",
  ResponsiblePerson: "x00102297",
  ResponsibleOrganization: "x00102299",
  InstitutionName: "x00080080",
};

function cleanDicomString(value: string | undefined): string {
  if (!value) return "";
  // Remove trailing null chars and whitespace, replace ^ with space
  return value.replace(/\0/g, "").replace(/\^/g, " ").trim();
}

function parseDicomSex(value: string | undefined): string {
  if (!value) return "";
  const v = value.trim().toUpperCase();
  if (v === "M") return "macho";
  if (v === "F") return "femea";
  return "";
}

export async function extractDicomMetadata(file: File): Promise<DicomPatientInfo | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);

    // Try parsing with default transfer syntax if not present
    const options = { TransferSyntaxUID: "1.2.840.10008.1.2" };
    const dataSet = dicomParser.parseDicom(byteArray, options);

    const patientName = cleanDicomString(dataSet.string(TAGS.PatientName));
    const responsavel =
      cleanDicomString(dataSet.string(TAGS.ResponsiblePerson)) ||
      cleanDicomString(dataSet.string(TAGS.ReferringPhysicianName)) ||
      cleanDicomString(dataSet.string(TAGS.InstitutionName));

    const especie = cleanDicomString(dataSet.string(TAGS.PatientSpeciesDescription));
    const raca = cleanDicomString(dataSet.string(TAGS.PatientBreedDescription));
    const sexo = parseDicomSex(dataSet.string(TAGS.PatientSex));
    const idade = cleanDicomString(dataSet.string(TAGS.PatientAge));

    // Weight can be a decimal string
    let peso = "";
    const weightStr = dataSet.string(TAGS.PatientWeight);
    if (weightStr) {
      const parsed = parseFloat(weightStr);
      if (!isNaN(parsed)) peso = parsed.toString();
    }

    return {
      nome: patientName,
      responsavel,
      especie,
      raca,
      sexo,
      idade,
      peso,
    };
  } catch (err) {
    console.error("Failed to extract DICOM metadata:", err);
    return null;
  }
}
