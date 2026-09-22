import request from 'supertest';
import { expect } from 'chai';
import fs from 'node:fs';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { loginAsAdmin, loginAsAluno } from './helpers/auth.js';

const testData = JSON.parse(
  fs.readFileSync(new URL('./fixtures/test-data.json', import.meta.url), 'utf8')
);

describe('Fluxo de autenticação e entrega de trabalho', () => {
  const identificador = Date.now();
  const aluno = {
    ...testData.aluno,
    email: testData.aluno.email.replace('@', `+${identificador}@`),
    matricula: `${testData.aluno.matricula}-${identificador}`,
  };
  const trabalho = { ...testData.trabalho };
  let alunoId;

  after(async () => {
    await mongoose.connection.close();
  });

  it('deve executar o fluxo completo de administrador e aluno', async () => {
    const adminToken = await loginAsAdmin(app, testData.admin);
    const resposta = await request(app)
      .post('/api/admin/alunos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(aluno);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({ nome: aluno.nome, email: aluno.email });
    expect(resposta.body).to.not.have.property('senha');
    alunoId = resposta.body.id;
    aluno.id = alunoId;

    const matricula = await request(app)
      .post(`/api/admin/disciplinas/${testData.disciplinaId}/matriculas`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alunoId });

    expect(matricula.status).to.equal(201);
    expect(matricula.body).to.include({ alunoId, disciplinaId: testData.disciplinaId });

    const alunoToken = await loginAsAluno(app, aluno);
    expect(alunoToken).to.be.a('string').and.not.empty;

    const entrega = await request(app)
      .post(`/api/alunos/${alunoId}/trabalhos`)
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ ...trabalho, disciplinaId: testData.disciplinaId });

    expect(entrega.status).to.equal(201);
    expect(entrega.body).to.include({
      alunoId,
      disciplinaId: testData.disciplinaId,
      titulo: trabalho.titulo,
      status: 'entregue',
    });
  });

  it('deve rejeitar credenciais inválidas', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: testData.admin.email, senha: testData.credenciaisInvalidas.senha });

    expect(resposta.status).to.equal(401);
    expect(resposta.body.error).to.equal('E-mail ou senha inválidos.');
  });
});
