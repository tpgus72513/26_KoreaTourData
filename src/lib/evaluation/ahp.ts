export interface AhpResult {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number | null;
  consistent: boolean;
}

export const AHP_RI_VERSION = 'ORNL–PITT (1982), n = 1…10';
export const AHP_RI_SOURCE = 'https://www.mdpi.com/2227-7390/12/6/828';
// The ORNL–PITT row reproduced in Mathematics 2024, 12(6), 828, Table 3.
// AHP CI/eigenvector and the 10% consistency convention: Wind & Saaty (1980), pp. 645–646.
const RANDOM_INDEX = [0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];
const TOLERANCE = 1e-10;

function validateMatrix(matrix: number[][]): number {
  if (!Array.isArray(matrix) || matrix.length < 2 || matrix.length > 10
    || matrix.some((row) => !Array.isArray(row) || row.length !== matrix.length)) {
    throw new Error('AHP 행렬은 2~10개 기준의 정방행렬이어야 합니다.');
  }
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      const value = matrix[row][column];
      if (!Number.isFinite(value) || value < 1 / 9 - TOLERANCE || value > 9 + TOLERANCE
        || (row === column && Math.abs(value - 1) > TOLERANCE)
        || Math.abs(value * matrix[column][row] - 1) > TOLERANCE) {
        throw new Error('AHP 비교값은 1/9~9의 상호 역수이며 대각선은 1이어야 합니다.');
      }
    }
  }
  return matrix.length;
}

export function calculateAhp(matrix: number[][]): AhpResult {
  const size = validateMatrix(matrix);
  const multiply = (weights: number[]) => matrix.map((row) => row.reduce((sum, value, index) => sum + value * weights[index], 0));
  let weights = Array<number>(size).fill(1 / size);
  let converged = false;
  for (let iteration = 0; iteration < 10000; iteration += 1) {
    const product = multiply(weights);
    const total = product.reduce((sum, value) => sum + value, 0);
    const next = product.map((value) => value / total);
    const difference = Math.max(...next.map((value, index) => Math.abs(value - weights[index])));
    weights = next;
    if (difference < 1e-13) { converged = true; break; }
  }
  if (!converged) throw new Error('AHP 주고유벡터 계산이 수렴하지 않았습니다.');
  const product = multiply(weights);
  const lambdaMax = product.reduce((sum, value, index) => sum + value / weights[index], 0) / size;
  const ci = Math.max(0, (lambdaMax - size) / (size - 1));
  const cr = size === 2 ? null : ci / RANDOM_INDEX[size];
  return { weights, lambdaMax, ci, cr, consistent: cr === null || cr <= 0.1 };
}

/** Equal expert influence; aggregate judgments by geometric mean, preserving reciprocity. */
export function aggregateAhp(matrices: number[][][]): AhpResult {
  if (!Array.isArray(matrices) || matrices.length === 0) throw new Error('최소 한 명의 전문가 비교행렬이 필요합니다.');
  const size = validateMatrix(matrices[0]);
  for (const matrix of matrices) {
    if (validateMatrix(matrix) !== size) throw new Error('모든 전문가 행렬의 기준 수와 순서가 같아야 합니다.');
    if (!calculateAhp(matrix).consistent) throw new Error('일관성 기준을 넘는 전문가 비교행렬을 먼저 재검토해야 합니다.');
  }
  const combined = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) =>
    Math.exp(matrices.reduce((sum, matrix) => sum + Math.log(matrix[row][column]), 0) / matrices.length)));
  return calculateAhp(combined);
}
