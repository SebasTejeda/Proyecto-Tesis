"""
run_15_random.py — Genera 15 pacientes sinteticos con datos demograficos
realistas y features de estilo de vida COMPLETAMENTE ALEATORIAS dentro de
los rangos validos del formulario real (sin plantillas ni severidad
"esperada" prefijada). Ejecuta 1 evaluacion real por paciente contra la
API (backend :8000 + modelo :8001) y deja que la severidad la determine
el modelo, sin forzar ninguna proporcion de acierto/desacuerdo.

La conformidad del especialista tambien se decide al azar (moneda cargada
realista: la mayoria de las veces un especialista que revisa un resultado
razonable lo confirma, pero no hay una proporcion fija objetivo — es un
sorteo independiente por paciente, no un diseño 90/10).

Uso:
    python run_15_random.py
"""

import csv
import json
import random
import time
import datetime
import argparse

import requests

BASE_URL = "http://127.0.0.1:8000"
DOCTOR_EMAIL = "tejedasebastian120@gmail.com"
DOCTOR_PASSWORD = "123456"

# Sin seed fija — cada corrida da una muestra distinta, tal como se pidio.

NOMBRES_M = [
    "Carlos", "Luis", "Jose", "Miguel", "Diego", "Andres", "Fernando", "Ricardo",
    "Jorge", "Manuel", "Alejandro", "Sebastian", "Gabriel", "Daniel", "Rodrigo",
    "Eduardo", "Javier", "Cesar", "Victor", "Martin", "Bruno", "Renzo", "Piero", "Adrian",
]
NOMBRES_F = [
    "Maria", "Ana", "Lucia", "Carmen", "Rosa", "Diana", "Andrea", "Camila",
    "Valeria", "Fiorella", "Gabriela", "Patricia", "Karen", "Milagros", "Daniela",
    "Alejandra", "Claudia", "Vanessa", "Melissa", "Estefania", "Ximena", "Paola", "Brenda", "Yesenia",
]
APELLIDOS = [
    "Garcia", "Rodriguez", "Gonzalez", "Fernandez", "Lopez", "Martinez", "Sanchez",
    "Perez", "Gomez", "Diaz", "Torres", "Ramirez", "Flores", "Vargas", "Castillo",
    "Rojas", "Chavez", "Mendoza", "Reyes", "Ortiz", "Silva", "Nunez", "Aguilar",
    "Quispe", "Mamani", "Huaman", "Rivera", "Salazar", "Cruz", "Medina",
]

DISAGREEMENT_OPTIONS = [
    "El nivel de riesgo es mayor al indicado",
    "El nivel de riesgo es menor al indicado",
    "El paciente no presenta riesgo depresivo",
    "Los factores identificados no son los principales",
    "El modelo no considera información clínica relevante",
]

SEVERIDADES = ["Ninguno", "Leve", "Moderado/Alto"]


def generar_nombre(sexo: str) -> str:
    nombre = random.choice(NOMBRES_M if sexo == "Masculino" else NOMBRES_F)
    apellido1, apellido2 = random.sample(APELLIDOS, 2)
    return f"{nombre} {apellido1} {apellido2}"


def generar_telefono() -> str:
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(8))


def generar_dni_unicos(n: int) -> list:
    dnis = set()
    while len(dnis) < n:
        dnis.add(str(random.randint(60000000, 69999999)))
    return list(dnis)


def generar_fecha_nacimiento(edad: int) -> str:
    """mes/dia <= hoy para que la edad calculada sea exactamente `edad`."""
    hoy = datetime.date.today()
    birth_year = hoy.year - edad
    birth_month = random.randint(1, hoy.month)
    birth_day = random.randint(1, hoy.day) if birth_month == hoy.month else random.randint(1, 28)
    return datetime.date(birth_year, birth_month, birth_day).isoformat()


def generar_features_aleatorias() -> dict:
    """
    Features de estilo de vida totalmente aleatorias, dentro de los mismos
    rangos validos que usa el formulario real del frontend (ver
    evaluation.ts): sin perfil objetivo, sin clustering hacia ningun
    resultado en particular.
    """
    return dict(
        horas_sueno=round(random.uniform(3.0, 10.0), 1),
        vida_social=random.randint(1, 4),
        frecuencia_ejercicio=random.randint(0, 2),
        redes_sociales=round(random.uniform(0.5, 10.0), 1),
        nivel_estres=random.randint(1, 5),
        calidad_sueno=random.randint(1, 4),
        soledad_percibida=random.randint(1, 4),
        apoyo_familiar=random.randint(1, 4),
        autoestima=random.randint(1, 5),
        estado_civil=random.randint(0, 5),
    )


def decidir_conformidad_realista(severidad_predicha: str, ratio_confirmado: float):
    """
    Sorteo independiente por paciente con probabilidad `ratio_confirmado`
    de confirmar (no es un diseno fijo por conteo, es un sorteo — el
    resultado final ronda esa proporcion pero no cae exacto).
    """
    if random.random() < ratio_confirmado:
        return "confirmed", None, None

    otras = [s for s in SEVERIDADES if s != severidad_predicha]
    juicio_real = random.choice(otras)
    razon = random.choice(DISAGREEMENT_OPTIONS)
    return "rejected", razon, juicio_real


def top_features_shap(shap_values, n=3):
    if not shap_values:
        return ""
    ordenado = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:n]
    return "; ".join(f"{k}={v:+.4f}" for k, v in ordenado)


def login() -> str:
    r = requests.post(f"{BASE_URL}/auth/token", data={"username": DOCTOR_EMAIL, "password": DOCTOR_PASSWORD})
    r.raise_for_status()
    return r.json()["access_token"]


def main():
    parser = argparse.ArgumentParser(description="Genera pacientes sinteticos con evaluaciones reales via API.")
    parser.add_argument("--n", type=int, default=15, help="Cantidad de pacientes a generar.")
    parser.add_argument("--confirm-ratio", type=float, default=0.8, help="Probabilidad de doctor_agreement=confirmed.")
    parser.add_argument("--output-prefix", default="test_results", help="Prefijo de los archivos de salida.")
    args = parser.parse_args()
    n_pacientes = args.n
    ratio_confirmado = args.confirm_ratio

    print(f"Autenticando como {DOCTOR_EMAIL} ...")
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    print("Login OK.\n")

    dnis = generar_dni_unicos(n_pacientes)
    resultados = []

    for i in range(1, n_pacientes + 1):
        sexo = random.choice(["Masculino", "Femenino"])
        nombre = generar_nombre(sexo)
        dni = dnis[i - 1]
        telefono = generar_telefono()
        edad = random.randint(18, 25)
        fecha_nacimiento = generar_fecha_nacimiento(edad)
        feature_set = generar_features_aleatorias()

        fila = {
            "paciente_num": i,
            "nombre_completo": nombre,
            "dni": dni,
            "telefono": telefono,
            "fecha_nacimiento": fecha_nacimiento,
            "edad": edad,
            "sexo": sexo,
            "paciente_test_id": None,
            "evaluation_id": None,
            "respuestas_cuestionario": json.dumps(feature_set, ensure_ascii=False),
            "riesgo_predicho": None,
            "severidad_predicha": None,
            "probabilidad": None,
            "top_features_shap": "",
            "doctor_agreement": None,
            "disagreement_reason": None,
            "doctor_severity_judgment": None,
            "tiempo_respuesta_ms": None,
            "status_code": None,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "observaciones": "",
        }

        try:
            patient_payload = {
                "nombre_completo": nombre,
                "dni": dni,
                "fecha_nacimiento": fecha_nacimiento,
                "sexo": sexo,
                "telefono": telefono,
            }
            r_pat = requests.post(f"{BASE_URL}/patients/", json=patient_payload, headers=headers)
            if r_pat.status_code != 201:
                fila["status_code"] = r_pat.status_code
                fila["observaciones"] = f"Fallo creando paciente: {r_pat.text}"
                resultados.append(fila)
                print(f"[{i:02d}] FALLO creando paciente -> {r_pat.status_code}: {r_pat.text[:200]}")
                continue

            patient_id = r_pat.json()["id"]
            fila["paciente_test_id"] = patient_id

            eval_payload = {
                "patient_id": patient_id,
                "doctor_notes": "Paciente sintetico de prueba — muestra aleatoria (Hito 11)",
                "model_features": feature_set,
            }

            t0 = time.perf_counter()
            r_eval = requests.post(f"{BASE_URL}/evaluations/", json=eval_payload, headers=headers)
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

            fila["tiempo_respuesta_ms"] = elapsed_ms
            fila["status_code"] = r_eval.status_code

            if r_eval.status_code != 201:
                fila["observaciones"] = f"Fallo creando evaluacion: {r_eval.text}"
                resultados.append(fila)
                print(f"[{i:02d}] FALLO creando evaluacion -> {r_eval.status_code}: {r_eval.text[:200]}")
                continue

            body = r_eval.json()
            evaluation_id = body["id"]
            fila["evaluation_id"] = evaluation_id
            pred = body.get("model_prediction") or {}
            fila["riesgo_predicho"] = pred.get("risk_binary")
            fila["severidad_predicha"] = pred.get("severity")
            fila["probabilidad"] = pred.get("risk_probability")
            fila["top_features_shap"] = top_features_shap(pred.get("shap_values"))

            agreement, razon, severity_judgment = decidir_conformidad_realista(fila["severidad_predicha"], ratio_confirmado)
            agreement_payload = {"doctor_agreement": agreement}
            if razon:
                agreement_payload["disagreement_reason"] = razon
            if severity_judgment:
                agreement_payload["doctor_severity_judgment"] = severity_judgment

            r_agr = requests.patch(
                f"{BASE_URL}/evaluations/{evaluation_id}/agreement", json=agreement_payload, headers=headers
            )
            if r_agr.status_code == 200:
                agr_body = r_agr.json()
                fila["doctor_agreement"] = agr_body.get("doctor_agreement")
                fila["disagreement_reason"] = agr_body.get("disagreement_reason")
                fila["doctor_severity_judgment"] = agr_body.get("doctor_severity_judgment")
                fila["observaciones"] = "OK"
            else:
                fila["observaciones"] = f"Fallo registrando conformidad: {r_agr.text}"

            print(f"[{i:02d}] {nombre:28s} sexo={sexo:10s} edad={edad} "
                  f"severidad={str(fila['severidad_predicha']):14s} "
                  f"prob={fila['probabilidad']} agreement={fila['doctor_agreement']} ({elapsed_ms} ms)")

        except requests.RequestException as e:
            fila["observaciones"] = f"Excepcion de red: {e}"
            print(f"[{i:02d}] EXCEPCION: {e}")

        resultados.append(fila)

    columnas = [
        "paciente_num", "nombre_completo", "dni", "telefono", "fecha_nacimiento", "edad", "sexo",
        "paciente_test_id", "evaluation_id", "respuestas_cuestionario",
        "riesgo_predicho", "severidad_predicha", "probabilidad", "top_features_shap",
        "doctor_agreement", "disagreement_reason", "doctor_severity_judgment",
        "tiempo_respuesta_ms", "status_code", "timestamp", "observaciones",
    ]
    with open(f"{args.output_prefix}.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columnas)
        writer.writeheader()
        writer.writerows(resultados)

    with open(f"{args.output_prefix}.json", "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    total = len(resultados)
    ok = [r for r in resultados if r["status_code"] == 201]
    fallidos = [r for r in resultados if r["status_code"] != 201]

    print("\n" + "=" * 70)
    print("RESUMEN DE EJECUCION")
    print("=" * 70)
    print(f"Total de pacientes:  {total}")
    print(f"OK (201):            {len(ok)}")
    print(f"Fallidos:            {len(fallidos)}")
    if fallidos:
        for r in fallidos:
            print(f"  - #{r['paciente_num']}: status={r['status_code']} | {r['observaciones']}")

    if ok:
        from collections import Counter
        print("\nDistribucion de severidad_predicha (resultado natural del modelo, sin forzar):")
        for sev, cnt in Counter(r["severidad_predicha"] for r in ok).most_common():
            print(f"  {sev}: {cnt}")

        confirmados = sum(1 for r in ok if r["doctor_agreement"] == "confirmed")
        rechazados = sum(1 for r in ok if r["doctor_agreement"] == "rejected")
        print(f"\ndoctor_agreement=confirmed: {confirmados}/{len(ok)}")
        print(f"doctor_agreement=rejected:  {rechazados}/{len(ok)}")

    print(f"\nArchivos generados: {args.output_prefix}.csv, {args.output_prefix}.json")


if __name__ == "__main__":
    main()
