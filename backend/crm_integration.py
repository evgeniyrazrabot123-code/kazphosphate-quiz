import requests

# Передаем сюда Webhook из AmoCRM, Bitrix24 или Telegram Bot API
CRM_WEBHOOK_URL = "https://your-crm-domain.com/api/v1/lead/create" 

def send_to_crm(employee_data: dict, result_data: dict):
    payload = {
        "title": f"Проверка знаний: {employee_data['full_name']}",
        "full_name": employee_data['full_name'],
        "position": employee_data['position'],
        "score": f"{result_data['score']} / {result_data['total']}",
        "photo_user": employee_data['photo_user_path'],
        "photo_license": employee_data['photo_license_path'],
    }
    
    try:
        # Раскомментируй при подключении реального Webhook CRM
        # response = requests.post(CRM_WEBHOOK_URL, json=payload, timeout=5)
        print(f"[CRM MOCK] Данные отправлены в CRM: {payload}")
    except Exception as e:
        print(f"[CRM ERROR] Не удалось отправить данные: {e}")