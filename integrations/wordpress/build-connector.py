"""Build a WordPress plugin zip with an explicit root directory and Unix permissions."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent
source = root / 'nestoria-crm-connector'
output = root / 'nestoria-crm-connector-0.2.0.zip'
entries = ['nestoria-crm-connector.php', 'README.md']
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    directory = ZipInfo('nestoria-crm-connector/')
    directory.create_system = 3
    directory.external_attr = (0o40755 << 16) | 0x10
    archive.writestr(directory, b'')
    for filename in entries:
        item = ZipInfo('nestoria-crm-connector/' + filename)
        item.create_system = 3
        item.compress_type = ZIP_DEFLATED
        item.external_attr = 0o100644 << 16
        archive.writestr(item, (source / filename).read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.namelist() == ['nestoria-crm-connector/'] + ['nestoria-crm-connector/' + item for item in entries]
    assert archive.infolist()[0].is_dir()
    for filename in entries:
        assert archive.read('nestoria-crm-connector/' + filename) == (source / filename).read_bytes()
    assert b'Plugin Name: Khushii CRM Connector for Nestoria' in archive.read('nestoria-crm-connector/nestoria-crm-connector.php')
print('Built and verified:', output)
